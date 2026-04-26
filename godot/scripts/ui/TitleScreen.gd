extends Control

# Title screen that starts the local Mission01 scene.
@onready var start_button: Button = $Panel/StartButton

func _ready() -> void:
	start_button.pressed.connect(_start_game)
	start_button.grab_focus()

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("p1_shoot") or event.is_action_pressed("ui_accept"):
		_start_game()

func _start_game() -> void:
	get_tree().change_scene_to_file("res://scenes/main/Game.tscn")
