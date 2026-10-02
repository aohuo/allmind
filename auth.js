"use strict";

/*
 * 登录与注册页面的前端交互
 * ========================
 * 1. 检查必填项、邮箱格式和密码长度；
 * 2. 在输入框下方显示中文错误；
 * 3. 支持显示或隐藏密码；
 * 4. 阻止演示表单真的向服务器提交。
 *
 * 重要边界：前端验证只能改善用户体验，不能代替服务器验证。以后接入后端时，
 * 服务器仍必须重新检查邮箱、用户名和密码，密码还应经过安全哈希后再存储。
 */

/*
 * querySelectorAll() 返回页面中所有带 data-auth-form 属性的表单。
 * 当前每个页面只有一个表单，但使用复数 forms 可以让 login.html 与
 * register.html 安全地共用同一个脚本。
 */
const forms = document.querySelectorAll("[data-auth-form]");
const passwordToggles = document.querySelectorAll("[data-toggle-password]");

/**
 * 为一个输入框设置或清除错误信息。
 *
 * @param {HTMLInputElement} input 需要更新状态的输入框
 * @param {string} message 错误文字；空字符串表示当前没有错误
 */
function setFieldMessage(input, message) {
  /* setCustomValidity 会把自定义结果写入浏览器原生表单验证状态。 */
  input.setCustomValidity(message);

  /* 每个错误元素的 id 都遵循“输入框 id + -error”的命名规则。 */
  const errorElement = document.querySelector(`#${input.id}-error`);

  if (message) {
    input.setAttribute("aria-invalid", "true");
    errorElement.textContent = message;
    errorElement.hidden = false;
  } else {
    input.removeAttribute("aria-invalid");
    errorElement.textContent = "";
    errorElement.hidden = true;
  }
}

/**
 * 根据输入框类型检查一项数据。
 *
 * @param {HTMLInputElement} input 要检查的输入框
 * @returns {boolean} true 表示有效，false 表示无效
 */
function validateInput(input) {
  /* 先清除上一次的自定义错误，防止旧错误影响本次 validity 判断。 */
  setFieldMessage(input, "");

  /* trim() 去掉开头和结尾的空白，避免仅输入空格也通过必填检查。 */
  const value = input.value.trim();

  if (input.required && value === "") {
    const labelName = input.name === "username" ? "用户名" : input.name === "email" ? "邮箱" : "密码";
    setFieldMessage(input, `请输入${labelName}`);
    return false;
  }

  /* type="email" 使浏览器能够通过 typeMismatch 判断基本邮箱格式。 */
  if (input.type === "email" && input.validity.typeMismatch) {
    setFieldMessage(input, "请输入完整、有效的邮箱地址");
    return false;
  }

  /* minlength 属性提供规则，下面的判断提供更明确的中文说明。 */
  if (input.type === "password" && value.length < 6) {
    setFieldMessage(input, "密码不能少于 6 位");
    return false;
  }

  return true;
}

/* 为当前页面存在的每一个表单注册提交事件。 */
forms.forEach((form) => {
  const inputs = form.querySelectorAll(".auth-input");
  const feedback = form.querySelector("[data-form-feedback]");

  form.addEventListener("submit", (event) => {
    /* 当前没有后端接口，所以阻止浏览器刷新或发送数据。 */
    event.preventDefault();
    feedback.textContent = "";

    /*
     * Array.from() 把 NodeList 转成数组，并通过第二个参数对每个输入框执行验证。
     * 这里先生成 [true, false, ...] 结果数组，再用 every() 汇总，目的是确保所有
     * 输入框都会被检查。若直接写 inputs.every(validateInput)，遇到第一个 false
     * 就会提前停止，后面的错误提示将无法同时显示。
     */
    const validationResults = Array.from(inputs, (input) => validateInput(input));
    const allValid = validationResults.every((isValid) => isValid);

    if (!allValid) {
      /* :invalid 是浏览器原生伪类；focus() 把光标放到第一项错误上。 */
      form.querySelector(".auth-input:invalid")?.focus();
      return;
    }

    const formType = form.dataset.authForm;
    feedback.textContent = formType === "register"
      ? "注册信息格式正确；当前演示不会将账号保存到数据库。"
      : "登录信息格式正确；接入后端账号系统后才能完成真实登录。";
  });

  /* 用户修改输入后立即复查该项，让已经修正的红色错误及时消失。 */
  inputs.forEach((input) => {
    input.addEventListener("input", () => {
      if (input.getAttribute("aria-invalid") === "true") validateInput(input);
      feedback.textContent = "";
    });
  });
});

/* “显示/隐藏”按钮通过切换 input.type 决定密码是否以圆点遮挡。 */
passwordToggles.forEach((button) => {
  button.addEventListener("click", () => {
    const passwordInput = document.querySelector(`#${button.dataset.togglePassword}`);
    const shouldShow = passwordInput.type === "password";

    passwordInput.type = shouldShow ? "text" : "password";
    button.textContent = shouldShow ? "隐藏" : "显示";
    button.setAttribute("aria-pressed", String(shouldShow));
  });
});
