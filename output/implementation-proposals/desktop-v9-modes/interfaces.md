# 三路线项目与固定起点挑战：集成接口

2026-10-22。A00 单写正式源；本目录为可集成提案。项目档仍为 save v9，旧 craft v1 原样兼容。

## 已固定的数据

- 槽位：`main`、`craft-start-v1`。主槽保留原 v9 / v8 / v7 键；挑战没有旧版来源键。
- 挑战：`id: "craft-start-v1"`，`rulesVersion: "6.2.0"`，`seed: 277191004`；craft 推荐开局，workshop-heir / learn，三天赋 slow-and-steady、good-memory、warm-heart，初始分配 appearance 3 / intelligence 5 / physique 6 / family 6。
- 挑战为独立的 generation 1，6→75；新默认 world、无继承遗产。纯引擎候选创建入口 `ENGINE.createChallengeState(id)`，不发 persist，不改当前 state；选项来自 `ENGINE.getChallengeDefinitions()`。
- 普通游戏 state 不添加模式字段。挑战存储和导出采用 `{format:"echo-town-challenge",version:1,challengeId:"craft-start-v1",rulesVersion:"6.2.0",state:<v9>}`。主槽导入原始 v7/v8/v9；挑战只接收匹配本挑战 / 规则版本的 envelope。主槽不能导入挑战 envelope，挑战不能把主人生 raw JSON 当成挑战。
- envelope 和 state 均遵守原始 2 MiB、紧凑有效 512 KiB；导出紧凑格式。

## Save 公共 API

```js
getModeDefinitions() // 只读定义数组，main 与 craft-start-v1
getActiveSlot(options = {}) // {ok, slotId, ...}；坏 pointer 返回错误，不静默切 main
loadSlot(slotId, options = {}) // 只读指定槽；支持 defaultState；不改变 active
loadActive({defaultState, createTarget, storage} = {})
// createTarget(slotId) 为纯工厂，只有挑战为空/已清除时调用。
// 返回 {ok,state,slotId,needsCommit,...}。缺/坏主档不会用挑战覆盖。

commitLoad(loaded, options = {})
// loaded.state 先由 ENGINE.normalizeState 变成候选；需要提交时才写入。
// 不需要提交则直接返回候选；所有失败均不切内存。

persistSlot(slotId, state, options = {})
prepareSlotImport(slotId, text, options = {})
commitSlotImport(slotId, prepared, currentState, options = {})
removeSlot(slotId, options = {})
serializeSlot(slotId, state)
// 所有写操作必须匹配当前 active，防止旧 UI/陈旧页面写到别槽。
// backup、raw backup、clear 均隔离在指定槽；main v8/v7 原文永不改动。

switchSlot(targetSlotId, currentState, {
  normalize,        // 必填：ENGINE.normalizeState 的纯包装
  createTarget,     // 挑战为空或明确重开时调用 ENGINE.createChallengeState(id)
  defaultState,     // 主槽从未开始/明确清除后的普通初始 state
  resetTarget,      // 可选；仅允许明确重开 challenge，不能用它清空 main
  storage
})
// -> {ok,state,slotId,...}；ok 后才调用 ENGINE.replaceState。
```

旧 `load()` 永远读取 main 的最新有效引用，不随 active 指向挑战。旧 persist / commitImport / remove 默认 main，在 active 为挑战时拒绝误写。旧 prepareImport / serialize 保持原始 state 格式，UI 的模式入口必须使用对应 Slot API。

## 启动接线

```js
const defaults = ENGINE.getState();
const loaded = SAVE.loadActive({
  defaultState: defaults,
  createTarget: id => ENGINE.createChallengeState(id)
});
if (loaded.ok && loaded.state) {
  try { loaded.state = ENGINE.normalizeState(loaded.state); }
  catch { /* 显示错误并开启恢复锁，原指针与原档保留 */ }
  const ready = SAVE.commitLoad(loaded);
  if (ready.ok) {
    activeSlot = ready.slotId;
    ENGINE.replaceState(ready.state);
  } else { /* 不切换内存或模式；恢复锁 */ }
}
```

启动、手动切换、清除后的 UI 都从返回 slotId / `getActiveSlot()`投影模式名称。禁止 UI 直接访问 localStorage。

手动切换调用 switchSlot；只有成功后更新 activeSlot、replaceState、render。自动保存、SW 更新前保存使用 `persistSlot(activeSlot, ENGINE.getState())`；文件导出用 serializeSlot，文件导入先 prepareSlotImport → normalize candidate → commitSlotImport → replaceState。清除用 removeSlot，成功后主槽恢复 defaults，挑战用纯 createChallengeState；刷新会留在同一模式并生成同样的挑战起点。

挑战终局不应走主人生遗产交接 / 第二世命令；“重开挑战”调用同槽 switchSlot(resetTarget:true)，重新创建固定候选。可用瞬时引擎模式上下文禁止挑战内普通 START_LIFE / CONFIRM_LEGACIES 改成第二世，不必把模式写入 state/history；Save 也会拒绝 generation > 1 或继承遗产的挑战状态。

## 多键事务的提交顺序

持久指针包含 activeSlotId 和两槽 snapshot 引用。原主 v9 键保留；没有指针时完全沿用旧 main 行为。存在主槽 snapshot 后，load() 经受限 adapter 读取最新主引用。

1. 读取并校验当前指针和源/目标槽；坏最高层引用、缺失引用、坏主档均拒绝，不向下回退。
2. normalize 当前与目标候选、检查模式与固定挑战规则、容量；全程不修改引擎内存。
3. 写入不可变候选 snapshots；源与目标的原引用和旧原文都仍有效。
4. 再核对持久指针与来源未变化。
5. 单次 setItem 原子提交 `{activeSlotId, refs}`，这是唯一模式切换提交点。
6. 成功后调用方切换内存；清理仅本模块命名空间内不再被槽位/备份引用的旧 snapshots。失败不删有效引用，不改主档或原内存。

同一机制用于有指针后的自动保存与模式内导入，避免写目标主档成功而指针失败时无法可靠回滚。备份保存完整 payload，不借其他槽的主档。成功后 GC 保留两槽有效引用，防止每次保存无界积累；失败遗留的未引用临时快照可由后续成功清理，不触碰原始 v8/v7 或其他应用键。

## 三路线项目固定 schema

容器与 step 字段沿用 craft v1；根据项目 id 选择唯一合法终结指标，禁止跨类型指标字段：

| id | 19 / 24 岁 | 21 岁准备 | 最终指标 |
|---|---|---|---|
| craft-customers-youth-v1 | shop-shift，job，2 AP/2精力 | routine-repair，或 toolkit 12元 | finalCraft≥5 |
| study-practice-youth-v1 | tutor-shift，job，2 AP/2精力 | routine-study，或 study-notebook 10元 | finalStudy≥5 |
| community-network-youth-v1 | routine-care / routine-social，life，各1 AP/1精力 | routine-record，1 AP/1精力 | finalEmpathy≥5 |

history 仍用 stepsDone / preparationActionId，并按 id 限定合法准备及唯一 final 字段。完整 normalize 使用 registry，save 独立加载时也保留严格结构和真实 evidence/ledger 检查。
