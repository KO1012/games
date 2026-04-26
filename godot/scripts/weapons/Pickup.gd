extends Area2D

# Collectible placeholder for health and weapon refills.
@export_enum("health", "weapon") var pickup_kind := "health"
@export var amount := 25
@export var weapon_id := "machine_gun"
@export var weapon_resource: WeaponData

func _ready() -> void:
	body_entered.connect(_on_body_entered)

func _on_body_entered(body: Node) -> void:
	if not body.is_in_group("players"):
		return
	if body.has_method("collect_pickup"):
		body.collect_pickup(self)
	queue_free()
