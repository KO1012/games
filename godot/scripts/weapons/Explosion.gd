extends Area2D

# Short-lived radial damage area used by grenades, rockets, and boss death feedback.
@export var damage := 35
@export var owner_team := 0
@export var duration := 0.18
@export var screen_shake := 7.0

var source: Node
var applied := false

func configure(new_damage: int, team: int, owner_node: Node = null) -> void:
	damage = new_damage
	owner_team = team
	source = owner_node

func _ready() -> void:
	var game_state := get_node_or_null("/root/GameState")
	if game_state != null:
		game_state.request_screen_shake(screen_shake, duration)
	call_deferred("_apply_damage")

func _process(delta: float) -> void:
	duration -= delta
	modulate.a = clampf(duration / 0.18, 0.0, 1.0)
	if duration <= 0.0:
		queue_free()

func _apply_damage() -> void:
	if applied:
		return
	applied = true
	for area in get_overlapping_areas():
		if area.has_method("receive_damage"):
			var info := DamageInfo.new(damage, source if source != null else self, owner_team, Vector2.ZERO, global_position, PackedStringArray(["explosion"]))
			area.receive_damage(info)
