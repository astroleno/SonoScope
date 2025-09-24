## 模型转换与部署（CREPE / OpenL3 / Musicnn → 前端 tfjs）

本项目前端期望直接加载的路径（放置到 `app/public/model/**`）：

- CREPE: `/model/crepe/model.json`
- OpenL3: `/model/openl3/model.json`
- Musicnn: `/model/musicnn/model.json`

如果这些文件不存在，建议优先使用“服务端推理”（无需 tfjs 转换，最稳）。

---

### TL;DR（快速结论）

- 推荐方案：改“服务端推理”（无需 tfjs，稳、快、维护简单）。
- 需要纯前端离线推理：在 macOS/WSL/Linux 下用固定版本矩阵做一次性转换，把结果复制到 `app/public/model/**`。
- Windows 原生环境转换不稳定，除非必要，尽量不要在 Win 原生做 tfjs 转换。

---

## 方案A（推荐）：服务端推理（不做 tfjs 转换）

思路：前端不下发大模型。把短窗音频摘要/特征 POST 给后端；后端用 Python 模型（pip 即可）推理并返回。

- 优点：不受浏览器与 tfjs 依赖链限制；模型更新在服务器端完成。
- 缺点：增加几十到几百毫秒延迟，但对短窗摘要影响可控。

建议接口（示例）：

- `POST /api/model/crepe` → 返回基频/音高特征
- `POST /api/model/openl3` → 返回嵌入/音色特征
- `POST /api/model/musicnn` → 返回乐器标签/概率分布

前端策略：在 `useDanmuPipeline` 或调用处检查本地 `/model/**/model.json` 是否存在；不存在则自动走服务端。

---

## 方案B：macOS 本地转换为 tfjs（较稳）

固定版本矩阵（经验稳定组合）：

- Python: 3.10
- TensorFlow: 2.15.1
- tensorflowjs: 3.18.0（较少拉起 TF-DF）
- tensorflow-hub: 0.12.0
- protobuf: 3.20.3

步骤（以 CREPE 为例）：

```bash
# 1) 准备 Python 3.10（Homebrew 或 conda）
brew install python@3.10
python3.10 -m venv .venv
source .venv/bin/activate

# 2) 安装稳定依赖组合
pip install --upgrade pip
pip install "tensorflow==2.15.1" "tensorflowjs==3.18.0" \
            "tensorflow-hub==0.12.0" "protobuf==3.20.3"
pip install crepe

# 3) 导出 Keras 模型（仓库已提供脚本）
python scripts/export-tfjs-models.py   # 生成 crepe.h5（OpenL3/Musicnn 见下）

# 4) 转换为 tfjs 并放到前端目录
mkdir -p app/public/model/crepe
tensorflowjs_converter --input_format=keras --output_format=tfjs_layers_model \
  ./crepe.h5 ./app/public/model/crepe

# 5) 校验
test -f app/public/model/crepe/model.json && echo CREPE_READY || echo CREPE_MISSING
```

OpenL3：

```bash
pip install openl3
# 将 scripts/export-tfjs-models.py 增补 openl3 导出逻辑（生成 openl3.h5）
mkdir -p app/public/model/openl3
tensorflowjs_converter --input_format=keras --output_format=tfjs_layers_model \
  ./openl3.h5 ./app/public/model/openl3
```

Musicnn：

- 某些版本不直接暴露 Keras 模型，需要手动构建网络结构后 `load_weights()`，再 `model.save('musicnn.h5')`，然后转换：

```bash
tensorflowjs_converter --input_format=keras --output_format=tfjs_layers_model \
  ./musicnn.h5 ./app/public/model/musicnn
```

若导出/构建困难，建议回退方案A（服务端推理）。

---

## 方案C：Windows / WSL / Docker 转换（可行但脆弱）

Windows 原生常见冲突：

- 新版 tensorflowjs 会拉起 TF-DF（C++ 扩展），与 TF 版本不匹配；
- numpy 1.24+ 移除 `np.object`，旧版 tfjs 仍引用；
- tensorflow-hub 与 protobuf 版本要求冲突。

建议：

1) 用 WSL Ubuntu 或 Linux 容器转换（推荐）。在容器里使用“方案B”的版本矩阵，转换完成后仅把产物复制回 `app/public/model/**`。

2) 如果必须 Windows 原生：
   - 固定：`tensorflow==2.15.1` + `tensorflowjs==3.18.0` + `tensorflow-hub==0.12.0` + `protobuf==3.20.3`
   - 若报 `np.object` 错误：降 `numpy==1.23.5`
   - 若报 TF-DF/二进制扩展问题：卸载 `tensorflow-decision-forests` 或换 tfjs 旧版
   - 仍不稳：回退方案A（服务端推理）

---

## 常见报错与修复

- `inference.so not found` / TF-DF 与 TensorFlow 不兼容：
  - 原因：tensorflowjs 版本拉起 TF-DF，但与 TF 不匹配
  - 处理：改用 `tensorflowjs==3.18.0`；必要时卸载 `tensorflow-decision-forests`

- `module 'numpy' has no attribute 'object'`：
  - 原因：numpy 1.24+ 移除 `np.object`，旧版 tfjs 仍引用
  - 处理：`pip install numpy==1.23.5`

- `Descriptors cannot be created directly`（protobuf）：
  - 原因：tensorflow-hub 与 protobuf 版本不兼容
  - 处理：`pip install protobuf==3.20.3 tensorflow-hub==0.12.0`

---

## 验证 Checklist

- 前端目录存在：
  - `app/public/model/crepe/model.json`
  - `app/public/model/openl3/model.json`（若转换）
  - `app/public/model/musicnn/model.json`（若转换）
- 浏览器控制台不再出现 `/model/**/model.json` 404；
- 日志中“特征窗口不足”不再长期出现（已通过最小帧入队兜底修复）。

---

## 失败兜底

若 tfjs 转换反复失败：

1) 仅保留 `yamnet.task`（你已具备）+ 启发式/HPSS 的基础特征；
2) 采用“方案A 服务端推理”补足 CREPE/OpenL3/Musicnn 高阶特征；
3) 必要时使用 macOS/WSL 容器做一次性转换，将产物拷回 `app/public/model/**`。


