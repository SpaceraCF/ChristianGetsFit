const FITBIT_AUTH_URL = "https://www.fitbit.com/oauth2/authorize";
const FITBIT_TOKEN_URL = "https://api.fitbit.com/oauth2/token";
const FITBIT_API = "https://api.fitbit.com/1/user/-";

export function getFitbitAuthUrl(state: string): string {
  const clientId = process.env.FITBIT_CLIENT_ID;
  if (!clientId) return "";
  const redirectUri = `${process.env.APP_URL ?? "http://localhost:3000"}/api/fitbit/callback`;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "heartrate sleep activity",
    state,
    expires_in: "31536000",
  });
  return `${FITBIT_AUTH_URL}?${params.toString()}`;
}

export async function exchangeFitbitCode(
  code: string,
  userId: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number } | null> {
  const clientId = process.env.FITBIT_CLIENT_ID;
  const clientSecret = process.env.FITBIT_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const redirectUri = `${process.env.APP_URL ?? "http://localhost:3000"}/api/fitbit/callback`;
  const res = await fetch(FITBIT_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in ?? 28800,
  };
}

export async function getFitbitHeartRate(
  accessToken: string,
  date: string,
  startTime: string,
  endTime: string
): Promise<{ heartRate: number; minutesAboveRest: number } | null> {
  const url = `${FITBIT_API}/activities/heart/date/${date}/1d/1min.json`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const intervals: Array<{ time: string; value: number }> = data["activities-heart-intraday"]?.dataset ?? [];
  const inRange = intervals.filter((d) => d.time >= startTime && d.time <= endTime);
  if (inRange.length === 0) return null;
  const avg = inRange.reduce((s, d) => s + d.value, 0) / inRange.length;
  const rest = 60;
  const above = inRange.filter((d) => d.value >= rest + 20).length;
  return { heartRate: Math.round(avg), minutesAboveRest: above };
}

export async function getFitbitSleep(
  accessToken: string,
  date: string
): Promise<{ durationMins: number; efficiency: number; recommendation: "rest" | "normal" | "push" } | null> {
  const url = `https://api.fitbit.com/1.2/user/-/sleep/date/${date}.json`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const summary = data.summary;
  if (!summary) return null;
  const totalMins = summary.totalMinutesAsleep ?? 0;
  const efficiency = summary.efficiency ?? 0;
  let recommendation: "rest" | "normal" | "push" = "normal";
  if (totalMins < 360 || efficiency < 75) recommendation = "rest";
  else if (totalMins >= 420 && efficiency >= 85) recommendation = "push";
  return {
    durationMins: totalMins,
    efficiency,
    recommendation,
  };
}

/** Returns true if HR data suggests 20+ min of elevated activity in the workout window */
export async function verifyWorkoutWithFitbit(
  accessToken: string,
  completedAt: Date
): Promise<boolean> {
  const date = completedAt.toISOString().slice(0, 10);
  const start = new Date(completedAt.getTime() - 5 * 60 * 1000);
  const end = new Date(completedAt.getTime() + 35 * 60 * 1000);
  const startTime = start.toTimeString().slice(0, 5);
  const endTime = end.toTimeString().slice(0, 5);
  const hr = await getFitbitHeartRate(accessToken, date, startTime, endTime);
  return hr != null && hr.minutesAboveRest >= 20;
}
