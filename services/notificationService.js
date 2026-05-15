const schedule = require('node-schedule');
const logger = require('./loggerService');

const activeJobs = new Map();

const scheduleReminder = (id, cronExpression, callback) => {
  try {
    if (activeJobs.has(id)) {
      activeJobs.get(id).cancel();
    }
    const job = schedule.scheduleJob(cronExpression, callback);
    activeJobs.set(id, job);
    logger.info(`Reminder scheduled: ${id}`, 'REMINDER');
    return true;
  } catch (error) {
    logger.error(`Reminder error: ${error.message}`, 'REMINDER_ERROR');
    return false;
  }
};

const cancelReminder = (id) => {
  if (activeJobs.has(id)) {
    activeJobs.get(id).cancel();
    activeJobs.delete(id);
    logger.info(`Reminder cancelled: ${id}`, 'REMINDER');
    return true;
  }
  return false;
};

const scheduleOnce = (id, date, callback) => {
  try {
    const job = schedule.scheduleJob(new Date(date), () => {
      callback();
      activeJobs.delete(id);
    });
    activeJobs.set(id, job);
    logger.info(`One-time reminder: ${id} at ${date}`, 'REMINDER');
    return true;
  } catch (error) {
    logger.error(`One-time reminder error: ${error.message}`, 'REMINDER_ERROR');
    return false;
  }
};

const getActiveJobs = () => {
  return Array.from(activeJobs.keys());
};

module.exports = { scheduleReminder, cancelReminder, scheduleOnce, getActiveJobs };
