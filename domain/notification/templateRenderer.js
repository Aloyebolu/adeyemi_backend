import courseModel from "#domain/course/course.model.js";

/* 🧠 Dynamic variable resolver */
export async function resolveVariable(variable, context) {
  const [scope, ...keys] = variable.split(".");

  // Map available data sources
  const sources = {
    user: context.user,
    settings: context.settings,
    department: context.department,
  };

  let data = sources[scope];
  for (const key of keys) {
    if (!data) break;
    data = data[key];
  }

  // 🧩 Handle computed or custom variables
  if (!data) {
    switch (variable) {
      case "user.age_category":
        if (context.user?.dob) {
          const age = new Date().getFullYear() - new Date(context.user.dob).getFullYear();
          data = age < 18 ? "Underage" : age < 30 ? "Young Adult" : "Mature";
        }
        break;
      case "settings.current_semester_name":
        data = context.settings?.semester ? `Semester ${context.settings.semester}` : "Unknown";
        break;
      case "departments.count":
        data = context.departmentCount ?? 0;
        break;
      case "user.department.course_count":
        if (context.user?.department_id) {
          const count = await courseModel.countDocuments({ department_id: context.user.department_id });
          data = count;
        } else {
          data = 0;
        }
        break;
      case "timeGreeting":
        const now = new Date();
        const hour = now.getHours();

        if (hour >= 5 && hour < 12) {
          data = "Good morning! ☀️";
        } else if (hour >= 12 && hour < 17) {
          data = "Good afternoon! 🌤️";
        } else if (hour >= 17 && hour < 21) {
          data = "Good evening! 🌙";
        } else {
          data = "Good night! 🌃";
        }
        break;
      case "portal_url":
        data = context.settings?.websiteUrl || "";
        break;

      default:
        data = "";
    }
  }

  return data ?? "";
}

/* 🧩 Template renderer */
export async function renderTemplate(template, context) {
  const matches = template.match(/{{\s*([\w.]+)\s*}}/g) || [];

  let rendered = template;
  for (const match of matches) {
    const variable = match.replace(/{{\s*|\s*}}/g, "");
    const value = await resolveVariable(variable, context);
    rendered = rendered.replace(match, value);
  }
  return rendered;
}