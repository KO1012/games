class_name WeaponData
extends Resource

# Tunable weapon definition shared by players and future network replication.
@export var weapon_id := "pistol"
@export var display_name := "Pistol"
@export var fire_interval := 0.25
@export var projectile_scene: PackedScene
@export var projectile_speed := 900.0
@export var damage := 10
@export var spread_angle := 0.0
@export var pellet_count := 1
@export var ammo := 0
@export var infinite_ammo := false
@export var muzzle_offset := Vector2(24, -12)
@export var recoil := 0.0
@export var screen_shake := 0.0
