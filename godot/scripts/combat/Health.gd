class_name Health
extends Node

# Reusable health component for players, enemies, and bosses.
signal damaged(info: DamageInfo, current: int, maximum: int)
signal died(info: DamageInfo)
signal health_changed(current: int, maximum: int)

@export var max_health := 100
@export var invulnerable := false

var current_health := 100
var dead := false

func _ready() -> void:
	reset(max_health)

func reset(value: int = -1) -> void:
	current_health = max_health if value < 0 else clampi(value, 0, max_health)
	dead = current_health <= 0
	health_changed.emit(current_health, max_health)

func apply_damage(info: DamageInfo) -> bool:
	if dead or invulnerable or info == null or info.amount <= 0:
		return false
	current_health = max(0, current_health - info.amount)
	damaged.emit(info, current_health, max_health)
	health_changed.emit(current_health, max_health)
	if current_health <= 0:
		dead = true
		died.emit(info)
	return true

func heal(amount: int) -> void:
	if dead or amount <= 0:
		return
	current_health = min(max_health, current_health + amount)
	health_changed.emit(current_health, max_health)
