class_name WeaponController
extends Node

# Owns weapon inventory, fire cadence, ammo, and projectile spawning.
signal weapon_changed(weapon: WeaponData, ammo_text: String)
signal ammo_changed(ammo_text: String)
signal fired


@export var initial_weapon_paths := PackedStringArray([
	"res://resources/weapons/pistol.tres",
	"res://resources/weapons/machine_gun.tres",
	"res://resources/weapons/shotgun.tres",
	"res://resources/weapons/rocket_launcher.tres"
])

const GRENADE_SCENE := preload("res://scenes/weapons/Grenade.tscn")

var weapons: Array[WeaponData] = []
var ammo_by_id: Dictionary = {}
var current_index := 0
var cooldown := 0.0

func _ready() -> void:
	_load_initial_weapons()
	_emit_weapon_state()

func _physics_process(delta: float) -> void:
	cooldown = max(0.0, cooldown - delta)

func current_weapon() -> WeaponData:
	if weapons.is_empty():
		return null
	return weapons[current_index]

func switch_next() -> void:
	if weapons.size() <= 1:
		return
	current_index = (current_index + 1) % weapons.size()
	_emit_weapon_state()

func fire(owner_node: Node2D, origin: Vector2, aim_direction: Vector2, team: int, projectile_parent: Node) -> bool:
	var weapon: WeaponData = current_weapon()
	if weapon == null or cooldown > 0.0 or projectile_parent == null:
		return false
	if not weapon.infinite_ammo and int(ammo_by_id.get(weapon.weapon_id, 0)) <= 0:
		return false
	if aim_direction.length_squared() < 0.01:
		aim_direction = Vector2.RIGHT
	var count: int = max(1, int(weapon.pellet_count))
	var spread: float = deg_to_rad(weapon.spread_angle)
	for i in range(count):
		var projectile: Node2D = weapon.projectile_scene.instantiate() as Node2D
		var t: float = 0.0 if count == 1 else (float(i) / float(count - 1)) - 0.5
		var direction: Vector2 = aim_direction.normalized().rotated(t * spread)
		projectile_parent.add_child(projectile)
		projectile.global_position = origin + direction * weapon.muzzle_offset.x + Vector2(0, weapon.muzzle_offset.y)
		if projectile.has_method("configure"):
			projectile.configure(direction, weapon.projectile_speed, weapon.damage, team, owner_node)
		if weapon.weapon_id == "rocket_launcher":
			projectile.set("explode_on_hit", true)
			projectile.set("explosion_damage", weapon.damage)
	if not weapon.infinite_ammo:
		ammo_by_id[weapon.weapon_id] = int(ammo_by_id.get(weapon.weapon_id, 0)) - 1
	cooldown = weapon.fire_interval
	if weapon.screen_shake > 0.0:
		var game_state := get_node_or_null("/root/GameState")
		if game_state != null:
			game_state.request_screen_shake(weapon.screen_shake, 0.08)
	fired.emit()
	ammo_changed.emit(get_ammo_text())
	return true

func throw_grenade(owner_node: Node2D, origin: Vector2, aim_direction: Vector2, team: int, projectile_parent: Node) -> bool:
	if projectile_parent == null:
		return false
	var grenade: Node2D = GRENADE_SCENE.instantiate() as Node2D
	projectile_parent.add_child(grenade)
	grenade.global_position = origin
	if grenade.has_method("configure"):
		grenade.configure(aim_direction, team, owner_node)
	fired.emit()
	return true

func add_weapon(resource: WeaponData) -> void:
	if resource == null:
		return
	for weapon in weapons:
		if weapon.weapon_id == resource.weapon_id:
			if not weapon.infinite_ammo:
				ammo_by_id[weapon.weapon_id] = int(ammo_by_id.get(weapon.weapon_id, 0)) + resource.ammo
			_emit_weapon_state()
			return
	weapons.append(resource)
	ammo_by_id[resource.weapon_id] = resource.ammo
	current_index = weapons.size() - 1
	_emit_weapon_state()

func add_weapon_by_id(weapon_id: String) -> void:
	for path in initial_weapon_paths:
		var weapon: WeaponData = load(path) as WeaponData
		if weapon != null and weapon.weapon_id == weapon_id:
			add_weapon(weapon)
			return

func get_weapon_name() -> String:
	var weapon: WeaponData = current_weapon()
	return "None" if weapon == null else weapon.display_name

func get_ammo_text() -> String:
	var weapon: WeaponData = current_weapon()
	if weapon == null:
		return "--"
	if weapon.infinite_ammo:
		return "INF"
	return str(max(0, int(ammo_by_id.get(weapon.weapon_id, 0))))

func _load_initial_weapons() -> void:
	weapons.clear()
	ammo_by_id.clear()
	for path in initial_weapon_paths:
		var weapon: WeaponData = load(path) as WeaponData
		if weapon != null:
			weapons.append(weapon)
			ammo_by_id[weapon.weapon_id] = weapon.ammo
	current_index = 0

func _emit_weapon_state() -> void:
	weapon_changed.emit(current_weapon(), get_ammo_text())
	ammo_changed.emit(get_ammo_text())
