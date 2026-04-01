# FRONTEND_WORKFLOW.md

## 目标

本工作流基于 [FRONTEND_INTEGRATION.md](d:/MyPythonScripts/richup.frontend/FRONTEND_INTEGRATION.md) 制定，用于指导 `richup.frontend` 后续 Vue 3 + Pinia + Socket.io 客户端开发。

核心原则：

- 服务器是状态真源，前端只做展示、缓存和事件驱动更新。
- `cash`、`propCards`、`hasImmunity`、`priceHikeActive` 等私密信息，不从广播推断，只接受定向事件或重连快照。
- `constructibleTileIds` 只使用服务器下发结果，前端不得本地计算。
- 断线恢复以 `RECONNECT_SUCCESS` 为最终一致性入口。

---

## 当前基线

已完成：

- Vite + Vue 3 + Pinia 项目基础结构
- 核心类型定义
- `useGameStore`
- `useSelfStore`
- `usePlayersStore`
- Socket 客户端初始化
- 握手与断线重连骨架
- Socket 监听器骨架

对应文件：

- [src/stores/useGameStore.ts](d:/MyPythonScripts/richup.frontend/src/stores/useGameStore.ts)
- [src/stores/useSelfStore.ts](d:/MyPythonScripts/richup.frontend/src/stores/useSelfStore.ts)
- [src/stores/usePlayersStore.ts](d:/MyPythonScripts/richup.frontend/src/stores/usePlayersStore.ts)
- [src/socket/client.ts](d:/MyPythonScripts/richup.frontend/src/socket/client.ts)
- [src/socket/listeners.ts](d:/MyPythonScripts/richup.frontend/src/socket/listeners.ts)

---

## 后续工作流

### Phase 1: 完成事件到 Store 的真实更新

输入来源：

- 文档第 3 节 State Mapping
- 文档第 5 节 Event Listeners
- 文档第 6 节 定向私密事件

执行内容：

- 将 [src/socket/listeners.ts](d:/MyPythonScripts/richup.frontend/src/socket/listeners.ts) 中现有 `TODO` 逐步替换为真实状态更新
- 优先完成核心主链路事件：
  - `MAP_GENERATED`
  - `TURN_STARTED`
  - `PLAYER_MOVED`
  - `TILE_EVENT`
  - `PROPERTY_PURCHASED`
  - `GAME_PAUSED`
  - `GAME_RESUMED`
  - `PLAYER_DISCONNECTED`
  - `RECONNECT_SUCCESS`
  - `CASH_UPDATED`
- 为 `game / self / players` 三个 store 补必要 action，避免在监听器里直接散写状态

产出物：

- 可执行的广播事件处理函数
- Store action 命名统一
- 重连后状态完整恢复

验收标准：

- 玩家移动、回合切换、暂停恢复、断线重连能正确反映到 Pinia
- 本人私密状态不会从广播中被错误覆盖

---

### Phase 2: 补 action emit 层

输入来源：

- 文档第 4 节 Action List

执行内容：

- 新建统一动作发送模块，例如：
  - `src/socket/actions.ts`
  - 或 `src/services/gameActions.ts`
- 将所有前端动作封装为显式函数：
  - `startGame()`
  - `rollDice()`
  - `endTurn()`
  - `buyProperty()`
  - `auctionBid(amount)`
  - `buildHouse(tileId)`
  - `proposeTrade(payload)`
  - `usePropCard(payload)`
- 在动作层进行最小参数校验，不在 UI 组件中直接硬写 `socket.emit`

产出物：

- 统一 action 发射层
- 动作 payload 类型补全

验收标准：

- UI 层不直接拼事件名
- 所有 emit 都可从一个模块追踪

---

### Phase 3: 建立页面级状态消费入口

输入来源：

- 已完成 store
- 已完成 socket listeners

执行内容：

- 按页面或模块拆出 composable / container 层
- 推荐先建：
  - `src/composables/useGameSession.ts`
  - `src/composables/useTurnState.ts`
  - `src/composables/useReconnectState.ts`
- 将页面渲染依赖从“直接读 socket”调整为“只读 Pinia + composable”

产出物：

- UI 使用稳定的状态读取入口
- Socket 与组件解耦

验收标准：

- 组件可以在不感知 socket 的前提下渲染核心状态

---

### Phase 4: 实现大厅与对局基础页面

输入来源：

- 文档第 1 节 REST 大厅接口
- 文档第 9 节 完整连接生命周期

执行内容：

- 实现基础页面路由和空壳布局：
  - 房间列表页
  - 创建 / 加入房间页
  - 游戏主页面
- 新建 REST API 模块，例如：
  - `src/api/rooms.ts`
- 打通以下流程：
  - 获取房间列表
  - 创建房间
  - 加入房间
  - 保存 `sessionToken` / `roomId`
  - 建立 socket 连接

产出物：

- 页面基础流转
- REST + Socket 衔接完成

验收标准：

- 能从大厅进入房间并开始建立实时连接

---

### Phase 5: 落地棋盘与回合交互 UI

输入来源：

- 文档第 5 节
- 文档第 7 节 `constructibleTileIds` 高亮

执行内容：

- 建立棋盘组件树，例如：
  - `src/components/board/BoardView.vue`
  - `src/components/board/BoardTile.vue`
  - `src/components/panels/PlayerPanel.vue`
  - `src/components/panels/ActionPanel.vue`
- 使用 `selfStore.constructibleSet` 做地块高亮
- 根据 `currentPhase + currentTurnPlayerId + self.id` 决定按钮可用性

产出物：

- 棋盘渲染
- 玩家状态面板
- 基础操作区

验收标准：

- 当前玩家、位置、地块归属、可建造状态能从 store 正确映射到 UI

---

### Phase 6: 补错误提示、拒绝反馈与重连体验

输入来源：

- 文档第 8 节 错误处理与操作拒绝
- 文档第 9 节 完整连接生命周期

执行内容：

- 为以下事件建立统一反馈机制：
  - `ACTION_REJECTED`
  - `AUCTION_BID_REJECTED`
  - `OPERATION_BLOCKED`
  - `PLAYER_DISCONNECTED`
  - `GAME_PAUSED`
- 推荐建立：
  - `src/stores/useUiStore.ts`
  - 或 `src/composables/useToastBus.ts`
- 加入暂停遮罩、重连提示、恢复提示

产出物：

- 统一 toast / banner / modal 反馈体系

验收标准：

- 所有拒绝和阻塞事件都有用户可见反馈
- 掉线和恢复过程对玩家可感知

---

### Phase 7: 扩展拍卖、交易、道具子系统

输入来源：

- 文档第 4 节 Action List
- 文档第 5 节 Event Listeners

执行内容：

- 在基础对局稳定后再补：
  - `useAuctionStore`
  - `useTradeStore`
- 拍卖系统优先支持：
  - 发起
  - 出价
  - 过牌
  - 落槌
- 交易系统优先支持：
  - 发起
  - 接受 / 拒绝 / 取消
  - 完成后刷新 owned tiles
- 道具系统优先支持：
  - `IMMUNITY`
  - `PRICE_HIKE`
  - `REMOTE_DICE`

产出物：

- 拍卖 UI
- 交易 UI
- 道具使用面板

验收标准：

- 子系统状态变化不污染基础回合流
- 所有复杂操作都能通过事件回放恢复

---

### Phase 8: 联调与回归清单

每次实现完一批功能后，按以下顺序回归：

1. `npm run type-check`
2. `npm run build`
3. 创建房间并建立连接
4. 断线重连并验证 `RECONNECT_SUCCESS`
5. 主循环验证：
   `TURN_STARTED -> ROLL_DICE -> PLAYER_MOVED -> TILE_EVENT -> END_TURN`
6. 私密事件验证：
   `CASH_UPDATED` 只影响自己
7. 地产事件验证：
   `PROPERTY_PURCHASED / BUILDING_BUILT / PROPERTY_FREED`
8. 暂停恢复验证：
   `PLAYER_DISCONNECTED -> GAME_PAUSED -> GAME_RESUMED`

---

## 推荐实施顺序

为了减少返工，后续开发按下面顺序推进：

1. 先补监听器真实状态更新
2. 再补 action emit 层
3. 再做大厅 REST 接入和路由
4. 再做棋盘 UI 与操作区
5. 最后补拍卖、交易、道具等复杂子系统

---

## 编码约束

后续实现时统一遵守：

- 所有代码只写在 `richup.frontend` 内
- 优先复用现有类型文件和 store
- 监听器负责“接收事件并调用 store action”，不要把复杂业务推导散落在组件中
- 组件层尽量不直接操作 socket
- 任何涉及 `selfView` 的完整恢复，优先走 `hydrate`
- 任何涉及 `constructibleTileIds` 的展示，不做本地推算

---

## 下一步默认动作

如果没有新的优先级指令，默认继续执行：

1. 完成 `listeners.ts` 中主链路事件的真实状态更新
2. 新建统一 `actions.ts` 发射层
3. 搭建大厅 REST 与房间进入流程

