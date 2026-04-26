extends EnemyBase

# MVP boss with alternating aimed and spread attacks.
signal boss_health_changed(current: int, maximum: int)
signal boss_died

@export var arena_left := 2980.0
@export var arena_right := 3420.0
@export var attack_interval := 1.1
@export var spread_projectiles := 5
@export var projectile_speed := 560.0
@export var projectile_damage := 10

var attack_timer := 0.7
var pattern := 0

func _ready() -> void:
	super._ready()
	add_to_group("bosses")
	health.health_changed.connect(_on_boss_health_changed)
	boss_health_changed.emit(health.current_health, health.max_health)

func _physics_process(delta: float) -> void:
	var target := find_nearest_player()
	if target == null:
		velocity.x = 0.0
		apply_gravity(delta)
		move_and_slide()
		return
	var delta_to_target := target.global_position - global_position
	facing = 1 if delta_to_target.x > 0.0 else -1
	velocity.x = facing * move_speed * 0.45
	if global_position.x < arena_left:
		velocity.x = absf(velocity.x)
	elif global_position.x > arena_right:
		velocity.x = -absf(velocity.x)
	attack_timer -= delta
	if attack_timer <= 0.0:
		if pattern % 2 == 0:
			_fire_aimed(delta_to_target.normalized())
		else:
			_fire_spread(delta_to_target.normalized())
		pattern += 1
		attack_timer = attack_interval
	apply_gravity(delta)
	move_and_slide()
	update_facing_visual()

func _fire_aimed(direction: Vector2) -> void:
	fire_projectile(direction, projectile_speed, projectile_damage + 2)

func _fire_spread(direction: Vector2) -> void:
	var spread := deg_to_rad(38.0)
	for i in range(spread_projectiles):
		var t := (float(i) / float(spread_projectiles - 1)) - 0.5
		fire_projectile(direction.rotated(t * spread), projectile_speed * 0.82, projectile_damage)

func _on_boss_health_changed(current: int, maximum: int) -> void:
	boss_health_changed.emit(current, maximum)

func die() -> void:
	if dead:
		return
	boss_died.emit()
	var game_state := get_node_or_null("/root/GameState")
	if game_state != null:
		game_state.request_screen_shake(14.0, 0.45)
	super.die()
