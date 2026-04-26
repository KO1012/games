class_name PlayerInput
extends RefCounted

# Converts local input actions into a compact input_state dictionary.
static func read_input(player_index: int, facing: int) -> Dictionary:
	var prefix := "p%d_" % player_index
	var axis_x := Input.get_axis(prefix + "left", prefix + "right")
	var axis_y := Input.get_axis(prefix + "up", prefix + "down")
	var aim := Vector2(axis_x, axis_y)
	if aim.length_squared() < 0.01:
		aim = Vector2(float(facing), 0.0)
	else:
		aim = aim.normalized()
	return {
		"move_axis": axis_x,
		"aim": aim,
		"down": Input.is_action_pressed(prefix + "down"),
		"jump_pressed": Input.is_action_just_pressed(prefix + "jump"),
		"shoot": Input.is_action_pressed(prefix + "shoot"),
		"grenade_pressed": Input.is_action_just_pressed(prefix + "grenade"),
		"switch_pressed": Input.is_action_just_pressed(prefix + "switch_weapon"),
		"interact_pressed": Input.is_action_just_pressed(prefix + "interact")
	}
