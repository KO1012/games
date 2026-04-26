extends Node2D

# Coordinates Mission01 players, respawns, encounters, boss state, HUD, and pause/restart.
const PLAYER_SCENE := preload("res://scenes/player/Player.tscn")
const EXPLOSION_SCENE := preload("res://scenes/weapons/Explosion.tscn")

@export var respawn_delay := 1.0

var players: Dictionary = {}
var current_checkpoint := Vector2.ZERO
var boss_alive := false
var mission_complete := false

@onready var mission: Node2D = $Mission01
@onready var spawn_director: SpawnDirector = $Mission01/SpawnDirector
@onready var hud: HUD = $HUD
@onready var coop_camera: CoopCamera = $CoopCamera
@onready var pause_menu: PauseMenu = $PauseMenu

func _ready() -> void:
	var game_state := get_node_or_null("/root/GameState")
	if game_state != null:
		game_state.reset_run()
	mission.get_node("Projectiles").add_to_group("projectile_parent")
	current_checkpoint = _spawn_position(1)
	if game_state != null:
		game_state.mark_checkpoint(current_checkpoint)
	_spawn_player(1)
	_connect_checkpoints()
	spawn_director.register_existing_triggers()
	spawn_director.enemy_spawned.connect(_on_enemy_spawned)
	spawn_director.encounter_started.connect(_on_encounter_started)
	spawn_director.encounter_cleared.connect(_on_encounter_cleared)
	hud.set_players(players)
	coop_camera.set_players(players.values())
	pause_menu.resume_requested.connect(_on_resume_requested)
	pause_menu.restart_requested.connect(_restart_mission)
	pause_menu.hide_menu()

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("p2_join") and not players.has(2):
		_spawn_player(2)
		hud.set_players(players)
		coop_camera.set_players(players.values())
	if event.is_action_pressed("pause"):
		_toggle_pause()
	if event.is_action_pressed("restart"):
		_restart_mission()

func _spawn_player(index: int) -> void:
	var player := PLAYER_SCENE.instantiate()
	mission.get_node("Players").add_child(player)
	player.player_index = index
	player.team = 1
	player.global_position = _spawn_position(index)
	player.respawn_position = player.global_position
	player.player_died.connect(_on_player_died)
	players[index] = player

func _spawn_position(index: int) -> Vector2:
	var node_name := "P%dSpawn" % index
	var marker := mission.get_node_or_null(node_name) as Marker2D
	return marker.global_position if marker != null else Vector2(120 + index * 48, 580)

func _connect_checkpoints() -> void:
	for checkpoint in get_tree().get_nodes_in_group("checkpoints"):
		if checkpoint is Checkpoint and not checkpoint.reached.is_connected(_on_checkpoint_reached):
			checkpoint.reached.connect(_on_checkpoint_reached)

func _on_checkpoint_reached(checkpoint: Checkpoint, _player: Node) -> void:
	current_checkpoint = checkpoint.global_position
	var game_state := get_node_or_null("/root/GameState")
	if game_state != null:
		game_state.mark_checkpoint(current_checkpoint)
	for player in players.values():
		if is_instance_valid(player):
			player.set_checkpoint(current_checkpoint)
	hud.show_message("Checkpoint", 1.0)

func _on_player_died(player: Node) -> void:
	hud.show_message("P%d Down" % player.player_index, respawn_delay)
	await get_tree().create_timer(respawn_delay).timeout
	if mission_complete or not is_instance_valid(player):
		return
	if _all_players_dead():
		hud.show_message("Checkpoint Restart", 1.0)
		_respawn_all_players()
	else:
		player.respawn_at(current_checkpoint + Vector2(player.player_index * 36, -8))

func _all_players_dead() -> bool:
	for player in players.values():
		if is_instance_valid(player) and player.alive:
			return false
	return true

func _respawn_all_players() -> void:
	for player in players.values():
		if is_instance_valid(player):
			player.respawn_at(current_checkpoint + Vector2(player.player_index * 40, -8))

func _on_enemy_spawned(enemy: Node) -> void:
	if enemy.is_in_group("bosses"):
		boss_alive = true
		if enemy.has_signal("boss_health_changed"):
			enemy.boss_health_changed.connect(_on_boss_health_changed)
		if enemy.has_signal("boss_died"):
			enemy.boss_died.connect(_on_boss_died)
		hud.show_boss(true)

func _on_encounter_started(trigger: SpawnTrigger) -> void:
	if trigger.lock_camera:
		hud.show_message("Area Locked", 0.8)

func _on_encounter_cleared(trigger: SpawnTrigger) -> void:
	if trigger.lock_camera and not boss_alive:
		hud.show_message("Area Clear", 0.8)

func _on_boss_health_changed(current: int, maximum: int) -> void:
	hud.set_boss_health(current, maximum)

func _on_boss_died() -> void:
	boss_alive = false
	for i in range(5):
		var explosion := EXPLOSION_SCENE.instantiate()
		mission.get_node("Projectiles").add_child(explosion)
		explosion.global_position = Vector2(3160 + i * 42, 520 - (i % 2) * 36)
		if explosion.has_method("configure"):
			explosion.configure(0, 0, self)
	await get_tree().create_timer(0.75).timeout
	_complete_mission()

func _complete_mission() -> void:
	mission_complete = true
	var game_state := get_node_or_null("/root/GameState")
	if game_state != null:
		game_state.mission_complete = true
	hud.show_boss(false)
	hud.show_message("MISSION CLEAR", 999.0)

func _toggle_pause() -> void:
	if mission_complete:
		return
	get_tree().paused = not get_tree().paused
	if get_tree().paused:
		pause_menu.show_menu()
	else:
		pause_menu.hide_menu()

func _on_resume_requested() -> void:
	get_tree().paused = false
	pause_menu.hide_menu()

func _restart_mission() -> void:
	get_tree().paused = false
	var game_state := get_node_or_null("/root/GameState")
	if game_state != null:
		game_state.mission_restarted.emit()
	get_tree().reload_current_scene()
