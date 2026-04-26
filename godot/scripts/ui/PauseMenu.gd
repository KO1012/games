class_name PauseMenu
extends CanvasLayer

# Pause overlay with resume and restart actions.
signal resume_requested
signal restart_requested

@onready var panel: Control = $Panel
@onready var resume_button: Button = $Panel/ResumeButton
@onready var restart_button: Button = $Panel/RestartButton

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	resume_button.pressed.connect(func(): resume_requested.emit())
	restart_button.pressed.connect(func(): restart_requested.emit())

func show_menu() -> void:
	visible = true
	panel.visible = true
	resume_button.grab_focus()

func hide_menu() -> void:
	visible = false
	panel.visible = false
