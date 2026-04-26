class_name Hitbox
extends Area2D

# Simple contact damage source for melee or hazard-like attacks.
@export var damage := 10
@export var owner_team := 0
@export var active := true
@export var one_shot := false

var source: Node

func _ready() -> void:
	area_entered.connect(_on_area_entered)

func _on_area_entered(area: Area2D) -> void:
	if not active or not area.has_method("receive_damage"):
		return
	var info := DamageInfo.new(damage, source if source != null else self, owner_team, Vector2.ZERO, global_position)
	if area.receive_damage(info) and one_shot:
		active = false
