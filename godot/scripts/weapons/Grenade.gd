extends CharacterBody2D

# Bouncing grenade that detonates after a short fuse.
@export var launch_speed := 520.0
@export var upward_boost := 360.0
@export var gravity := 1300.0
@export var fuse_time := 1.35
@export var bounce := 0.35
@export var explosion_scene: PackedScene = preload("res://scenes/weapons/Explosion.tscn")

var owner_team := 0
var source: Node

func configure(aim_direction: Vector2, team: int, owner_node: Node = null) -> void:
	owner_team = team
	source = owner_node
	var direction := aim_direction.normalized()
	if direction.length_squared() < 0.01:
		direction = Vector2.RIGHT
	velocity = Vector2(direction.x * launch_speed, min(direction.y * launch_speed, -120.0) - upward_boost)

func _physics_process(delta: float) -> void:
	velocity.y += gravity * delta
	var collision := move_and_collide(velocity * delta)
	if collision != null:
		velocity = velocity.bounce(collision.get_normal()) * bounce
	fuse_time -= delta
	if fuse_time <= 0.0:
		_explode()

func _explode() -> void:
	if explosion_scene != null:
		var explosion := explosion_scene.instantiate()
		get_parent().add_child(explosion)
		explosion.global_position = global_position
		if explosion.has_method("configure"):
			explosion.configure(35, owner_team, source)
	queue_free()
