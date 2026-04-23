import { getAgenda } from "../agenda.config.js";

/**
 * Add a department computation job to the queue
 * @param {Object} data - Job data
 * @param {string} data.departmentId - Department ID
 * @param {string} data.masterComputationId - Master computation ID
 * @param {string} data.computedBy - User ID who initiated
 * @param {string} [data.jobId] - Optional custom job ID
 * @param {string} [data.priority] - Job priority (low, normal, high)
 * @param {Date} [data.scheduledAt] - When to run the job
 * @returns {Promise<Object>} Created job
 */
export async function queueDepartmentJob(data) {
  const agenda = await getAgenda();

  const job = agenda.create("department-computation", {
    ...data,
    jobId: data.jobId || `dept-${Date.now()}`,
    createdAt: new Date().toISOString()
  });

  // Set schedule
  if (data.scheduledAt) {
    job.schedule(new Date(data.scheduledAt));
  } else {
    job.schedule(new Date()); // Run immediately
  }

  // Set priority
  if (data.priority) {
    job.priority(data.priority);
  }

  await job.save();
  console.log(`[Department Queue] Job added: ${job.attrs._id}`);

  return job;
}


/**
 * Cancel a department job
 * @param {string} jobId - Job ID to cancel
 * @returns {Promise<boolean>} Success status
 */
export async function cancelDepartmentJob(jobId) {
  const agenda = await getAgenda();
  
  try {
    const result = await agenda.cancel({ _id: jobId });
    console.log(`[Department Queue] Job cancelled: ${jobId}`);
    return result > 0;
  } catch (error) {
    console.error(`[Department Queue] Failed to cancel job ${jobId}:`, error);
    return false;
  }
}

/**
 * Get department job by ID
 * @param {string} jobId - Job ID
 * @returns {Promise<Object|null>} Job details
 */
export async function getDepartmentJob(jobId) {
  const agenda = await getAgenda();
  const jobs = await agenda.jobs({ _id: jobId });
  return jobs[0] || null;
}

/**
 * Requeue a failed department job
 * @param {string} jobId - Failed job ID
 * @returns {Promise<Object|null>} New job or null
 */
export async function requeueDepartmentJob(jobId) {
  const agenda = await getAgenda();
  
  try {
    const result = await agenda.requeue(jobId);
    console.log(`[Department Queue] Job requeued: ${jobId}`);
    return result;
  } catch (error) {
    console.error(`[Department Queue] Failed to requeue job ${jobId}:`, error);
    return null;
  }
}