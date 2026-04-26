class_name Checkpoint
extends Area2D

# Updates the active respawn point when a player reaches it.
signal reached(checkpoint: Checkpoint, player: Node)

@export var checkpoint_id := "checkpoint"

func _ready() -> void:
	add_to_group("checkpoints")
	body_entered.connect(_on_body_entered)

func _on_body_entered(body: Node) -> void:
	if body.is_in_group("players"):
		reached.emit(self, body)
