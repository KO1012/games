class_name Hurtbox
extends Area2D

# Receives damage and forwards it to a Health component.
signal damage_received(info: DamageInfo)

@export var health_path: NodePath
@export var team := 0

@onready var health: Health = get_node_or_null(health_path) as Health

func receive_damage(info: DamageInfo) -> bool:
	if info == null:
		return false
	if team != 0 and info.owner_team == team:
		return false
	if health == null:
		return false
	var applied := health.apply_damage(info)
	if applied:
		damage_received.emit(info)
	return applied

func set_team(value: int) -> void:
	team = value
