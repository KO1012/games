class_name CameraLockArea
extends Area2D

# Optional area for later arena camera locks.
signal lock_requested(area: CameraLockArea)
signal unlock_requested(area: CameraLockArea)

@export var locked_bounds := Rect2(Vector2.ZERO, Vector2(1280, 720))
@export var unlock_when_clear := true

func request_lock() -> void:
	lock_requested.emit(self)

func request_unlock() -> void:
	unlock_requested.emit(self)
