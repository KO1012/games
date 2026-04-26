class_name EnemyBase
extends CharacterBody2D

# Shared enemy behavior: target lookup, gravity, health, death, and drops.
signal enemy_died(enemy: Node)

@export var team := 2
@export var move_speed := 120.0
@export var gravity := 1600.0
@export var drop_chance := 0.08
@export var pickup_scene: PackedScene = preload("res://scenes/weapons/Pickup.tscn")

var facing := -1
var dead := false
var random := RandomNumberGenerator.new()
var visual_base_scale := Vector2.ONE

@onready var health: Health = $Health
@onready var hurtbox: Hurtbox = $Hurtbox
@onready var body_visual: Node2D = $Body

func _ready() -> void:
	add_to_group("enemies")
	hurtbox.team = team
	health.damaged.connect(_on_damaged)
	health.died.connect(_on_died)
	random.randomize()
	visual_base_scale = body_visual.scale

func find_nearest_player() -> Node2D:
	var best: Node2D = null
	var best_distance := INF
	for player in get_tree().get_nodes_in_group("players"):
		if not is_instance_valid(player) or player.get("alive") != true:
			continue
		var distance := global_position.distance_squared_to(player.global_position)
		if distance < best_distance:
			best_distance = distance
			best = player
	return best

func fire_projectile(direction: Vector2, speed: float, damage: int) -> void:
	var scene := preload("res://scenes/weapons/Projectile.tscn")
	var projectile := scene.instantiate()
	var parent := get_tree().get_first_node_in_group("projectile_parent")
	(parent if parent != null else get_tree().current_scene).add_child(projectile)
	projectile.global_position = global_position + Vector2(facing * 24, -16)
	projectile.configure(direction.normalized(), speed, damage, team, self)

func apply_gravity(delta: float) -> void:
	if not is_on_floor():
		velocity.y += gravity * delta

func update_facing_visual() -> void:
	if body_visual != null:
		body_visual.scale.x = absf(visual_base_scale.x) * float(facing)

func die() -> void:
	if dead:
		return
	dead = true
	_try_drop_pickup()
	enemy_died.emit(self)
	queue_free()

func _try_drop_pickup() -> void:
	if pickup_scene == null or random.randf() > drop_chance:
		return
	var pickup := pickup_scene.instantiate()
	get_parent().add_child(pickup)
	pickup.global_position = global_position + Vector2(0, -12)
	pickup.pickup_kind = "health" if random.randf() < 0.6 else "weapon"
	pickup.weapon_id = "machine_gun"

func _on_damaged(_info: DamageInfo, _current: int, _maximum: int) -> void:
	_flash_hit()

func _on_died(_info: DamageInfo) -> void:
	die()

func _flash_hit() -> void:
	body_visual.modulate = Color(1.0, 0.45, 0.45)
	await get_tree().create_timer(0.06).timeout
	if is_instance_valid(body_visual):
		body_visual.modulate = Color.WHITE
