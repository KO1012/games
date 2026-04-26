class_name SpawnTrigger
extends Area2D

# Trigger volume that asks SpawnDirector to spawn marker-defined enemies once.
signal triggered(trigger: SpawnTrigger)

@export var one_shot := true
@export var lock_camera := false

var has_triggered := false

func _ready() -> void:
	add_to_group("spawn_triggers")
	body_entered.connect(_on_body_entered)

func get_spawn_markers() -> Array[Marker2D]:
	var result: Array[Marker2D] = []
	var markers := get_node_or_null("Markers")
	if markers == null:
		return result
	for child in markers.get_children():
		if child is Marker2D:
			result.append(child)
	return result

func reset() -> void:
	has_triggered = false

func _on_body_entered(body: Node) -> void:
	if has_triggered and one_shot:
		return
	if not body.is_in_group("players"):
		return
	has_triggered = true
	triggered.emit(self)
