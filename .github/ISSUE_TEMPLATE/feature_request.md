name: Feature request / 功能请求
description: "Suggest an idea for this project"
title: "[Feature Request]"
labels: ["enhancement"]
body:
  - type: checkboxes
    id: confirm
    attributes:
      label: Confirm / 确认
      description: Please confirm / 请你确认
      options:
        - label: I have searched the Issue and found no related feature requests / 我已经搜索过Issue，没有找到相关的功能请求
          required: true
  - type: textarea
    id: description
    attributes:
      label: Feature Description / 功能描述
      description: Describe the feature you want / 描述你想要的功能
    validations:
      required: true
  - type: textarea
    id: how_to
    attributes:
      label: How to Implement / 如何实现
      description: How to implement this feature / 你觉得应该如何实现这个功能
    validations:
      required: false
  - type: textarea
    id: additional_context
    attributes:
      label: Additional Information / 附加信息
      description: Any other information you think might be helpful to implement this feature / 你觉得对实现此功能有帮助的其它信息
    validations:
      required: false