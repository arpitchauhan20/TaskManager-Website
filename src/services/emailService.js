// ==========================================
// Resend HTTPS Email Dispatch Service
// ==========================================

export async function sendTaskEmail({ taskId, recipient, title, description, deadline, priority, reminderTime, isTest = false }) {
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId,
        recipient,
        title,
        description,
        deadline,
        priority,
        reminderTime,
        isTest
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to dispatch email');
    }
    return { success: true, message: data.message || 'Email dispatched successfully!', id: data.id };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function sendAddUserRequest({ requesterName, requesterEmail, targetName, targetEmail, note }) {
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'add_user_request',
        recipient: 'arpitchauhan5586@gmail.com',
        requesterName,
        requesterEmail,
        targetName,
        targetEmail,
        note
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to dispatch add user request');
    }
    return { success: true, message: data.message || 'Request sent successfully!', id: data.id };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

