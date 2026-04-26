extends EnemyBase

# Fixed gun that periodically fires at the nearest player.
@export var attack_range := 860.0
@export var fire_interval := 0.95
@export var projectile_speed := 720.0
@export var projectile_damage := 9

var fire_cooldown := 0.5

func _physics_process(delta: float) -> void:
	var target := find_nearest_player()
	if target == null:
		return
	var delta_to_target := target.global_position - global_position
	facing = 1 if delta_to_target.x > 0.0 else -1
	update_facing_visual()
	if delta_to_target.length() > attack_range:
		return
	fire_cooldown -= delta
	if fire_cooldown <= 0.0:
		fire_projectile(delta_to_target.normalized(), projectile_speed, projectile_damage)
		fire_cooldown = fire_interval
