extends Node

# Run-wide state and shared signals for the Godot MVP.
signal screen_shake_requested(strength: float, duration: float)
signal p2_joined
signal mission_restarted

var players: Dictionary = {}
var current_checkpoint: Vector2 = Vector2.ZERO
var p2_active := false
var mission_complete := false
var game_over := false

# Networking extension point: later builds can flip this and feed input_state from a server tick.
var server_authoritative := false

func _ready() -> void:
	_ensure_input_actions()

func reset_run() -> void:
	players.clear()
	current_checkpoint = Vector2.ZERO
	p2_active = false
	mission_complete = false
	game_over = false

func register_player(player_index: int, player: Node) -> void:
	players[player_index] = player
	if player_index == 2:
		p2_active = true
		p2_joined.emit()

func unregister_player(player_index: int) -> void:
	players.erase(player_index)
	if player_index == 2:
		p2_active = false

func request_screen_shake(strength: float = 6.0, duration: float = 0.12) -> void:
	screen_shake_requested.emit(strength, duration)

func mark_checkpoint(position: Vector2) -> void:
	current_checkpoint = position

func _ensure_input_actions() -> void:
	var mapping := {
		"p1_left": [KEY_A], "p1_right": [KEY_D], "p1_up": [KEY_W], "p1_down": [KEY_S],
		"p1_jump": [KEY_K], "p1_shoot": [KEY_J], "p1_grenade": [KEY_L],
		"p1_switch_weapon": [KEY_U], "p1_interact": [KEY_I],
		"p2_left": [KEY_LEFT], "p2_right": [KEY_RIGHT], "p2_up": [KEY_UP], "p2_down": [KEY_DOWN],
		"p2_jump": [KEY_SHIFT], "p2_shoot": [KEY_ENTER], "p2_grenade": [KEY_PERIOD],
		"p2_switch_weapon": [KEY_SLASH], "p2_interact": [KEY_APOSTROPHE], "p2_join": [KEY_ENTER],
		"pause": [KEY_ESCAPE], "restart": [KEY_R]
	}
	for action in mapping.keys():
		if not InputMap.has_action(action):
			InputMap.add_action(action)
		if InputMap.action_get_events(action).is_empty():
			for keycode in mapping[action]:
				var event := InputEventKey.new()
				event.keycode = keycode
				InputMap.action_add_event(action, event)
