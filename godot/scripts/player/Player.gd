extends CharacterBody2D

# Local player controller for movement, aiming, weapons, damage, and respawn.
signal player_died(player: Node)
signal stats_changed

@export var player_index := 1
@export var player_id := "p1"
@export var team := 1
@export var move_speed := 260.0
@export var crouch_speed_multiplier := 0.45
@export var jump_velocity := -560.0
@export var gravity := 1600.0
@export var max_fall_speed := 980.0
@export var invincible_duration := 1.2

var facing := 1
var aim_vector := Vector2.RIGHT
var crouching := false
var alive := true
var active := true
var input_state: Dictionary = {}
var respawn_position := Vector2.ZERO
var invincible_time := 0.0
var anim_time := 0.0
var sprite_base_scale := Vector2(2.0, 2.0)

# Future online mode should replace this local input_state with server-authoritative snapshots.
var server_authoritative := false

@onready var health: Health = $Health
@onready var hurtbox: Hurtbox = $Hurtbox
@onready var weapon_controller: WeaponController = $WeaponController
@onready var body_visual: Sprite2D = $Body
@onready var muzzle_flash: Polygon2D = $MuzzleFlash
@onready var collision_shape: CollisionShape2D = $CollisionShape2D
@onready var jump_sfx: AudioStreamPlayer = get_node_or_null("JumpSfx") as AudioStreamPlayer
@onready var death_sfx: AudioStreamPlayer = get_node_or_null("DeathSfx") as AudioStreamPlayer
@onready var respawn_sfx: AudioStreamPlayer = get_node_or_null("RespawnSfx") as AudioStreamPlayer

func _ready() -> void:
	add_to_group("players")
	player_id = "p%d" % player_index
	hurtbox.team = team
	health.damaged.connect(_on_health_damaged)
	health.died.connect(_on_health_died)
	health.health_changed.connect(_on_health_changed)
	weapon_controller.weapon_changed.connect(_on_weapon_changed)
	weapon_controller.ammo_changed.connect(_on_ammo_changed)
	weapon_controller.fired.connect(_on_weapon_fired)
	respawn_position = global_position
	sprite_base_scale = body_visual.scale
	muzzle_flash.visible = false
	_apply_player_frame()
	var game_state := get_node_or_null("/root/GameState")
	if game_state != null:
		game_state.register_player(player_index, self)

func _exit_tree() -> void:
	var game_state := get_node_or_null("/root/GameState")
	if game_state != null:
		game_state.unregister_player(player_index)

func _physics_process(delta: float) -> void:
	_update_invincibility(delta)
	if not active or not alive:
		return
	input_state = PlayerInput.read_input(player_index, facing)
	var move_axis := float(input_state.get("move_axis", 0.0))
	if absf(move_axis) > 0.1:
		facing = 1 if move_axis > 0.0 else -1
	crouching = bool(input_state.get("down", false)) and is_on_floor()
	var speed_multiplier := crouch_speed_multiplier if crouching else 1.0
	velocity.x = move_axis * move_speed * speed_multiplier
	if not is_on_floor():
		velocity.y = min(max_fall_speed, velocity.y + gravity * delta)
	elif bool(input_state.get("jump_pressed", false)) and not crouching:
		velocity.y = jump_velocity
		if jump_sfx != null:
			jump_sfx.play()
	_update_aim()
	_update_visuals()
	move_and_slide()
	_handle_weapons()

func respawn_at(position: Vector2) -> void:
	global_position = position
	velocity = Vector2.ZERO
	alive = true
	active = true
	visible = true
	collision_shape.disabled = false
	hurtbox.monitoring = true
	health.invulnerable = false
	health.reset(health.max_health)
	if respawn_sfx != null:
		respawn_sfx.play()
	invincible_time = invincible_duration
	stats_changed.emit()

func set_checkpoint(position: Vector2) -> void:
	respawn_position = position

func collect_pickup(pickup: Node) -> void:
	if pickup.pickup_kind == "health":
		health.heal(pickup.amount)
	elif pickup.pickup_kind == "weapon":
		if pickup.weapon_resource != null:
			weapon_controller.add_weapon(pickup.weapon_resource)
		else:
			weapon_controller.add_weapon_by_id(pickup.weapon_id)
	stats_changed.emit()

func get_weapon_name() -> String:
	return weapon_controller.get_weapon_name()

func get_ammo_text() -> String:
	return weapon_controller.get_ammo_text()

func _handle_weapons() -> void:
	if bool(input_state.get("switch_pressed", false)):
		weapon_controller.switch_next()
	if bool(input_state.get("shoot", false)):
		weapon_controller.fire(self, global_position, aim_vector, team, _projectile_parent())
	if bool(input_state.get("grenade_pressed", false)):
		weapon_controller.throw_grenade(self, global_position + Vector2(0, -18), aim_vector, team, _projectile_parent())

func _projectile_parent() -> Node:
	var parent := get_tree().get_first_node_in_group("projectile_parent")
	return parent if parent != null else get_tree().current_scene

func _update_aim() -> void:
	var raw_aim: Vector2 = input_state.get("aim", Vector2(float(facing), 0.0))
	if crouching and raw_aim.y > 0.1:
		raw_aim = Vector2(float(facing), 0.0)
	if raw_aim.x != 0.0:
		facing = 1 if raw_aim.x > 0.0 else -1
	aim_vector = raw_aim.normalized()
	if aim_vector.length_squared() < 0.01:
		aim_vector = Vector2(float(facing), 0.0)

func _update_visuals() -> void:
	anim_time += get_physics_process_delta_time()
	_apply_player_frame()
	body_visual.scale = Vector2(sprite_base_scale.x * float(facing), sprite_base_scale.y * (0.72 if crouching else 1.0))
	muzzle_flash.position = aim_vector * 28.0 + Vector2(0, -12)
	muzzle_flash.rotation = aim_vector.angle()

func _apply_player_frame() -> void:
	var row: int = clampi(player_index - 1, 0, 2)
	var col := 0
	if not alive:
		col = 4
	elif not is_on_floor():
		col = 3
	elif absf(velocity.x) > 12.0:
		col = 1 if int(anim_time * 10.0) % 2 == 0 else 2
	body_visual.frame_coords = Vector2i(col, row)
	body_visual.modulate = Color.WHITE

func _on_health_damaged(_info: DamageInfo, _current: int, _maximum: int) -> void:
	invincible_time = invincible_duration
	health.invulnerable = true
	var game_state := get_node_or_null("/root/GameState")
	if game_state != null:
		game_state.request_screen_shake(4.0, 0.08)
	stats_changed.emit()

func _on_health_died(_info: DamageInfo) -> void:
	alive = false
	active = false
	visible = false
	collision_shape.disabled = true
	hurtbox.monitoring = false
	if death_sfx != null:
		death_sfx.play()
	player_died.emit(self)
	stats_changed.emit()

func _on_health_changed(_current: int, _maximum: int) -> void:
	stats_changed.emit()

func _on_weapon_changed(_weapon: WeaponData, _ammo_text: String) -> void:
	stats_changed.emit()

func _on_ammo_changed(_ammo_text: String) -> void:
	stats_changed.emit()

func _on_weapon_fired() -> void:
	muzzle_flash.visible = true
	await get_tree().create_timer(0.045).timeout
	if is_instance_valid(muzzle_flash):
		muzzle_flash.visible = false

func _update_invincibility(delta: float) -> void:
	if invincible_time <= 0.0:
		if health.invulnerable:
			health.invulnerable = false
		if visible:
			body_visual.visible = true
		return
	invincible_time -= delta
	body_visual.visible = int(invincible_time * 18.0) % 2 == 0
	if invincible_time <= 0.0:
		body_visual.visible = true
		health.invulnerable = false
