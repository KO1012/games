extends EnemyBase

# Basic infantry that advances and fires slow shots.
@export var preferred_distance := 260.0
@export var attack_range := 560.0
@export var fire_interval := 1.2
@export var projectile_speed := 520.0
@export var projectile_damage := 8
@export var contact_damage := 8

var fire_cooldown := 0.4
var contact_cooldown := 0.0

func _physics_process(delta: float) -> void:
	var target := find_nearest_player()
	if target != null:
		var delta_to_target := target.global_position - global_position
		facing = 1 if delta_to_target.x > 0.0 else -1
		if absf(delta_to_target.x) > preferred_distance:
			velocity.x = facing * move_speed
		else:
			velocity.x = move_toward(velocity.x, 0.0, move_speed * delta * 4.0)
		fire_cooldown -= delta
		contact_cooldown -= delta
		if delta_to_target.length() <= attack_range and fire_cooldown <= 0.0:
			fire_projectile(delta_to_target.normalized(), projectile_speed, projectile_damage)
			fire_cooldown = fire_interval
		if delta_to_target.length() <= 34.0 and contact_cooldown <= 0.0:
			_apply_contact_damage(target)
			contact_cooldown = 0.8
	else:
		velocity.x = move_toward(velocity.x, 0.0, move_speed * delta)
	apply_gravity(delta)
	move_and_slide()
	update_facing_visual()

func _apply_contact_damage(target: Node) -> void:
	var hurtbox := target.get_node_or_null("Hurtbox")
	if hurtbox != null and hurtbox.has_method("receive_damage"):
		hurtbox.receive_damage(DamageInfo.new(contact_damage, self, team, Vector2(facing * 80, -80), global_position))
