# Godot Migration Plan

## 保留原项目

原 Phaser + TypeScript + Vite 客户端、Colyseus + Node.js + TypeScript 服务端、shared 包、levels JSON 和原设计文档都保留。它们仍代表旧的双人远程合作机关闯关项目，不在本次任务中删除或重构。

## Godot 重做范围

新增 godot/ 作为独立 Godot 4.x 项目，玩法方向改为 2D 横版合作射击 MVP：

- 单机本地双人优先。
- 现有 `apps/client/public/assets` 资源优先复用；缺少的射击专用资源再用占位图形和 Godot 内置能力补足。
- 不使用受版权保护的角色、素材、音效、关卡或命名；当前接入资源来自旧项目定制资源与 Kenney CC0。
- 先完成标题界面、Mission01、玩家、武器、敌人、Boss、HUD 和通关闭环。

## 为什么先做本地双人

旧项目已经有 Colyseus 在线合作基础，但新玩法的核心风险在手感、射击、敌人和关卡推进。先做本地双人可以更快验证：

- CharacterBody2D 平台移动手感。
- 武器和伤害组件接口。
- 敌人 AI 和 Boss 节奏。
- 双人共享镜头与复活规则。
- MissionController 任务闭环。

在线联机应在这些核心规则稳定后再接入，避免过早锁死协议。

## 后续如何接在线

后续建议走 Godot Dedicated Server + ENet：

1. 保持玩家只发送 input_state。
2. 服务器权威处理移动、射击、敌人、伤害、掉落和任务事件。
3. 客户端只预测本地移动和播放视觉反馈。
4. Projectile spawn、damage、pickup、mission event 使用服务器事件广播。
5. 纯视觉粒子、枪口火光、屏幕震动不需要同步。

旧 Colyseus 服务端可以作为房间服务备选，但实时动作同步建议迁移到 Godot 服务端或独立权威模拟层。
