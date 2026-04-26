class_name CoopCamera
extends Camera2D

# Shared camera that frames both local players and supports shake feedback.
@export var follow_speed := 7.5
@export var min_zoom := Vector2(1.0, 1.0)
@export var max_zoom := Vector2(1.35, 1.35)
@export var zoom_distance := 760.0
@export var max_player_distance := 820.0
@export var world_bounds := Rect2(Vector2(0, 0), Vector2(3600, 720))

var players: Array[Node2D] = []
var shake_strength := 0.0
var shake_time := 0.0
var random := RandomNumberGenerator.new()

func _ready() -> void:
	make_current()
	var game_state := get_node_or_null("/root/GameState")
	if game_state != null:
		game_state.screen_shake_requested.connect(_on_screen_shake_requested)

func set_players(value: Array) -> void:
	players.clear()
	for player in value:
		if player is Node2D:
			players.append(player)

func _process(delta: float) -> void:
	var live_players := _live_players()
	if live_players.is_empty():
		return
	var center := Vector2.ZERO
	for player in live_players:
		center += player.global_position
	center /= live_players.size()
	center.x = clampf(center.x, world_bounds.position.x + 320.0, world_bounds.end.x - 320.0)
	center.y = clampf(center.y, 260.0, world_bounds.end.y - 180.0)
	global_position = global_position.lerp(center, min(1.0, follow_speed * delta))
	_enforce_distance(live_players)
	var max_distance := 0.0
	for player in live_players:
		max_distance = max(max_distance, player.global_position.distance_to(center))
	var zoom_t := clampf(max_distance / zoom_distance, 0.0, 1.0)
	zoom = min_zoom.lerp(max_zoom, zoom_t)
	_update_shake(delta)

func _live_players() -> Array[Node2D]:
	var result: Array[Node2D] = []
	for player in players:
		if is_instance_valid(player) and player.get("alive") == true:
			result.append(player)
	return result

func _enforce_distance(live_players: Array[Node2D]) -> void:
	if live_players.size() < 2:
		return
	var a := live_players[0]
	var b := live_players[1]
	var delta := b.global_position - a.global_position
	if absf(delta.x) <= max_player_distance:
		return
	var midpoint := (a.global_position.x + b.global_position.x) * 0.5
	var half := max_player_distance * 0.5
	a.global_position.x = clampf(a.global_position.x, midpoint - half, midpoint + half)
	b.global_position.x = clampf(b.global_position.x, midpoint - half, midpoint + half)

func _on_screen_shake_requested(strength: float, duration: float) -> void:
	shake_strength = max(shake_strength, strength)
	shake_time = max(shake_time, duration)

func _update_shake(delta: float) -> void:
	if shake_time <= 0.0:
		offset = Vector2.ZERO
		return
	shake_time -= delta
	offset = Vector2(random.randf_range(-shake_strength, shake_strength), random.randf_range(-shake_strength, shake_strength))
	if shake_time <= 0.0:
		offset = Vector2.ZERO
