# LEVEL_NOTES.md

## 设计边界

本批关卡重新设计为“一关一机制”的教学路径，最后一关综合。现有机制：`solid`、`oneWay`、`moving`、`pressure(hold|toggle)`、`interact`、`timed`、`door`、`spike`、`laser`、`crusher`、`exit`，以及目标动作 `delayMs`。服务器仍然是唯一权威。

## Level 001：Press & Cross

- 难度：1/5。
- 机制：`pressure` + `door`。
- 通关方式：一名玩家踩左侧压力板维持中门打开，另一名玩家跳过中门后踩右侧压力板，放第一名玩家通过，两人一起到达出口。

## Level 002：Hold Relay

- 难度：2/5。
- 机制：`pressure` + `mode: hold` + `door`，三板接力。
- 通关方式：起点板 `button-1` 开 door-1，中段板 `button-2` 同时开 door-1 和 door-2，终点板 `button-3` 开 door-2。一人持板让另一人前进，到达下一块板后接力切换；单人无法越过 door-1（顶 y=360 不可跳），强制双人接力。

## Level 003：Timed Sprint

- 难度：2/5。
- 机制：`timed` + `door`。
- 通关方式：踩下限时按钮后门保持开启 4.5 秒，两名玩家在窗口内一起冲到出口；超时后需要重新踩板。

## Level 004：Interact Lift

- 难度：3/5。
- 机制：`interact` + `moving` + `spike`。
- 通关方式：玩家靠近左侧面板按 E 启动 ferry 6 秒，ferry 在尖刺坑上方左右往返；两人轮流踏上 ferry 并抵达右侧平台。

## Level 005：Delayed Gate

- 难度：3/5。
- 机制：`pressure` + `delayMs: 1100` + `door`。
- 通关方式：压力板紧贴门的左侧（x=600，距门 96 px）。一人踩板等门约 1.1 秒后打开，队友越过；持板者离开后冲门，1.1 秒关门窗口约 0.4 秒可达，刚好够通过。

## Level 006：Strobe Lasers

- 难度：3/5。
- 机制：`laser cycle` + `spike`。
- 通关方式：两道反相激光墙轮流亮灭。玩家上到中间安全平台作为中转点，接力走过两道激光，再跳过出口前的尖刺。

## Level 007：Crusher Corridor

- 难度：4/5。
- 机制：`crusher`。
- 通关方式：路径压机在中央通道内上下往返。玩家在压机抬起的窗口一起走过路径下方，抵达出口。

## Level 008：Conveyor Outpost

- 难度：4/5。
- 机制：宽世界（1600）+ `pressure mode: hold` + `moving` + `spike`，双端按板。
- 通关方式：起点和终点各一块 hold 压力板，按住任一块都让 conveyor 持续来回；A 持起点板，B 骑 conveyor 过去后改持终点板，A 再骑 conveyor 反向。单人无法两端同时按，无法独自通关。

## Level 009：Cipher Doors

- 难度：4/5。
- 机制：双 `pressure mode: toggle` + 互斥 `open`/`close` 目标 + `door`，上下双路。
- 关卡布局：地面下路被 `door-amber`（y=420..656）封锁；上方加 `step-a`(y=560)、`step-b`(y=480) 阶梯和 `upper-path`(y=400..424) 长平台，`door-blue`（y=256..400）封住上路。两道门起步均关闭。
- 通关方式：button-cipher-a (左侧地面) 锁定后开 blue 关 amber → 上路通；button-cipher-b (中段地面 x=720) 锁定后开 amber 关 blue → 下路通。两人协调切换 latch，一人走上路 (跳阶梯过 blue) 一人走下路 (过 amber) 在右侧汇合。

## Level 010：Last Stand

- 难度：5/5。
- 机制：宽世界（1600）+ `mode: toggle` + `timed` + `delayMs` + `moving` + `laser cycle` + `crusher` + `spike`。
- 通关方式：起点 toggle ferry 跨过第一道尖刺坑；中段限时按钮关闭激光以供两人通过；后段在 crusher 抬起的窗口跳过 200 px 宽的 `spike-pit-b` 落在 `floor-end`（x=1280..1600）；最后一名玩家踩下延迟压力板（1s）提前开启最终门，两人一起进入 `requiresBothPlayers` 出口。
