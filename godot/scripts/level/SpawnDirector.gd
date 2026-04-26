class_name SpawnDirector
extends Node

# Spawns marker-authored encounters and reports when active enemies are cleared.
signal encounter_started(trigger: SpawnTrigger)
signal encounter_cleared(trigger: SpawnTrigger)
signal enemy_spawned(enemy: Node)

const ENEMY_SCENES := {
	"Soldier": preload("res://scenes/enemies/Soldier.tscn"),
	"Gunner": preload("res://scenes/enemies/Gunner.tscn"),
	"Turret": preload("res://scenes/enemies/Turret.tscn"),
	"Boss01": preload("res://scenes/enemies/Boss01.tscn")
}

var active_enemies: Array[Node] = []
var active_trigger: SpawnTrigger

func _ready() -> void:
	for trigger in get_tree().get_nodes_in_group("spawn_triggers"):
		_register_trigger(trigger)

func register_existing_triggers() -> void:
	for trigger in get_tree().get_nodes_in_group("spawn_triggers"):
		_register_trigger(trigger)

func _register_trigger(trigger: Node) -> void:
	if trigger is SpawnTrigger and not trigger.triggered.is_connected(_on_triggered):
		trigger.triggered.connect(_on_triggered)

func _on_triggered(trigger: SpawnTrigger) -> void:
	active_trigger = trigger
	encounter_started.emit(trigger)
	for marker in trigger.get_spawn_markers():
		_spawn_from_marker(marker)
	_check_clear()

func _spawn_from_marker(marker: Marker2D) -> void:
	var scene: PackedScene = null
	for key in ENEMY_SCENES.keys():
		if marker.name.begins_with(key):
			scene = ENEMY_SCENES[key]
			break
	if scene == null:
		return
	var enemy := scene.instantiate()
	var parent := get_parent().get_node_or_null("Enemies")
	(parent if parent != null else get_parent()).add_child(enemy)
	enemy.global_position = marker.global_position
	active_enemies.append(enemy)
	if enemy.has_signal("enemy_died"):
		enemy.enemy_died.connect(_on_enemy_died)
	enemy_spawned.emit(enemy)

func _on_enemy_died(enemy: Node) -> void:
	active_enemies.erase(enemy)
	_check_clear()

func _check_clear() -> void:
	active_enemies = active_enemies.filter(func(enemy): return is_instance_valid(enemy) and enemy.get("dead") != true)
	if active_enemies.is_empty() and active_trigger != null:
		encounter_cleared.emit(active_trigger)
