class_name HUD
extends CanvasLayer

# Minimal in-game HUD for local coop status, weapons, ammo, boss health, and messages.
var players: Dictionary = {}
var message_time := 0.0

@onready var p1_label: Label = $Root/TopBar/P1Label
@onready var p2_label: Label = $Root/TopBar/P2Label
@onready var weapon_label: Label = $Root/TopBar/WeaponLabel
@onready var ammo_label: Label = $Root/TopBar/AmmoLabel
@onready var boss_bar: ProgressBar = $Root/BossPanel/BossBar
@onready var boss_panel: Control = $Root/BossPanel
@onready var message_label: Label = $Root/MessageLabel

func _ready() -> void:
	show_boss(false)
	message_label.text = ""

func set_players(value: Dictionary) -> void:
	players = value

func _process(delta: float) -> void:
	_update_player_labels()
	if message_time > 0.0:
		message_time -= delta
		if message_time <= 0.0:
			message_label.text = ""

func _update_player_labels() -> void:
	var p1: Node = players.get(1) as Node
	if p1 != null and is_instance_valid(p1):
		p1_label.text = "P1 HP %d/%d" % [p1.health.current_health, p1.health.max_health]
		weapon_label.text = "Weapon %s" % p1.get_weapon_name()
		ammo_label.text = "Ammo %s" % p1.get_ammo_text()
	else:
		p1_label.text = "P1 --"
	var p2: Node = players.get(2) as Node
	if p2 != null and is_instance_valid(p2):
		p2_label.text = "P2 HP %d/%d" % [p2.health.current_health, p2.health.max_health]
	else:
		p2_label.text = "P2 Press Join"

func set_boss_health(current: int, maximum: int) -> void:
	boss_panel.visible = true
	boss_bar.max_value = maximum
	boss_bar.value = current

func show_boss(value: bool) -> void:
	boss_panel.visible = value

func show_message(text: String, duration: float = 1.4) -> void:
	message_label.text = text
	message_time = duration
