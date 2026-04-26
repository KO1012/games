class_name DamageInfo
extends RefCounted

# Immutable-ish payload passed from hit sources into hurtboxes and health.
var amount: int
var source: Node
var owner_team: int
var knockback: Vector2
var hit_position: Vector2
var tags: PackedStringArray

func _init(
	p_amount: int = 1,
	p_source: Node = null,
	p_owner_team: int = 0,
	p_knockback: Vector2 = Vector2.ZERO,
	p_hit_position: Vector2 = Vector2.ZERO,
	p_tags: PackedStringArray = PackedStringArray()
) -> void:
	amount = p_amount
	source = p_source
	owner_team = p_owner_team
	knockback = p_knockback
	hit_position = p_hit_position
	tags = p_tags
