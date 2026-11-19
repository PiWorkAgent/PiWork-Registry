## 插件上架申请

- 插件 id：
- 仓库地址：
- 最新 Release：`https://github.com/<owner>/<repo>/releases/latest`
- 插件包直链（应出现在上面的 Release 里）：
- 作者 / 联系方式：
- 许可证：
- 分类：
- 声明权限：
- 一句话说明：

### 提交前确认

- [ ] 仓库根目录有合法的 `manifest.json`（id、版本、`apiVersion`、权限）
- [ ] Release 里同时有 `<id>-<version>.zip` 和 `index.json`
- [ ] `index.json` 里的 `sha256` 与 zip 一致，`url` 是绝对 https 地址
- [ ] tag 与 manifest 版本一致（`v<version>`）
- [ ] 已阅读 README 的「信任模型」：上架不等于代码审核
- [ ] `sources.json` 的改动只有自己这条
