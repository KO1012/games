extends EnemyBase

# Ranged enemy that holds position and fires bursts.
@export var attack_range := 760.0
@export var fire_interval := 0.28
@export var burst_size := 3
@export var burst_pause := 1.35
@export var projectile_speed := 650.0
@export var projectile_damage := 7

var shot_timer := 0.2
var burst_left := 0
var pause_timer := 0.0

func _physics_process(delta: float) -> void:
	var target := find_nearest_player()
	velocity.x = move_toward(velocity.x, 0.0, move_speed * delta * 3.0)
	if target != null:
		var delta_to_target := target.global_position - global_position
		facing = 1 if delta_to_target.x > 0.0 else -1
		if delta_to_target.length() <= attack_range:
			_update_burst(delta, delta_to_target.normalized())
	apply_gravity(delta)
	move_and_slide()
	update_facing_visual()

func _update_burst(delta: float, direction: Vector2) -> void:
	if pause_timer > 0.0:
		pause_timer -= delta
		return
	if burst_left <= 0:
		burst_left = burst_size
	shot_timer -= delta
	if shot_timer <= 0.0:
		fire_projectile(direction, projectile_speed, projectile_damage)
		burst_left -= 1
		shot_timer = fire_interval
		if burst_left <= 0:
			pause_timer = burst_pause
