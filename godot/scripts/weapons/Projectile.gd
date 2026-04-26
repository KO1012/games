extends Area2D

# Fast Area2D projectile with wall timeout and hurtbox damage.
@export var speed := 900.0
@export var damage := 10
@export var lifetime := 2.0
@export var owner_team := 0
@export var explode_on_hit := false
@export var explosion_damage := 40
@export var explosion_scene: PackedScene = preload("res://scenes/weapons/Explosion.tscn")

var direction := Vector2.RIGHT
var source: Node

func _ready() -> void:
	area_entered.connect(_on_area_entered)
	body_entered.connect(_on_body_entered)

func configure(new_direction: Vector2, new_speed: float, new_damage: int, team: int, owner_node: Node = null) -> void:
	direction = new_direction.normalized()
	speed = new_speed
	damage = new_damage
	owner_team = team
	source = owner_node
	rotation = direction.angle()

func _physics_process(delta: float) -> void:
	global_position += direction * speed * delta
	lifetime -= delta
	if lifetime <= 0.0:
		queue_free()

func _on_area_entered(area: Area2D) -> void:
	if not area.has_method("receive_damage"):
		return
	var info := DamageInfo.new(damage, source if source != null else self, owner_team, direction * 160.0, global_position)
	if area.receive_damage(info):
		_destroy()

func _on_body_entered(body: Node) -> void:
	if body is StaticBody2D:
		_destroy()

func _destroy() -> void:
	if explode_on_hit:
		_spawn_explosion()
	queue_free()

func _spawn_explosion() -> void:
	if explosion_scene == null:
		return
	var explosion := explosion_scene.instantiate()
	get_parent().add_child(explosion)
	explosion.global_position = global_position
	if explosion.has_method("configure"):
		explosion.configure(explosion_damage, owner_team, source)
