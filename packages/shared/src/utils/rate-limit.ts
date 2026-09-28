import { BandwidthProfile } from '../types/index.js';

/**
 * Formats a bandwidth profile into the official MikroTik RouterOS Rate-Limit string
 * Format:
 *   rx-rate[/tx-rate] [rx-burst-rate[/tx-burst-rate]] [rx-burst-threshold[/tx-burst-threshold]] [rx-burst-time[/tx-burst-time]] [priority] [rx-rate-min[/tx-rate-min]]
 *
 * NOTE on RouterOS directions:
 *   rx-rate = Client transmit (Upload from device to router)
 *   tx-rate = Client receive (Download from router to device)
 */
export function formatMikrotikRateLimit(profile: BandwidthProfile): string {
  const uploadK = Math.max(64, Math.floor(profile.uploadSpeedKbps));
  const downloadK = Math.max(64, Math.floor(profile.downloadSpeedKbps));

  const baseRate = `${uploadK}k/${downloadK}k`;

  // If burst parameters are specified, append them
  if (
    profile.burstUploadKbps &&
    profile.burstDownloadKbps &&
    profile.burstThresholdUpKbps &&
    profile.burstThresholdDownKbps &&
    profile.burstDurationSeconds
  ) {
    const burstRate = `${Math.floor(profile.burstUploadKbps)}k/${Math.floor(profile.burstDownloadKbps)}k`;
    const burstThreshold = `${Math.floor(profile.burstThresholdUpKbps)}k/${Math.floor(profile.burstThresholdDownKbps)}k`;
    const burstTime = `${profile.burstDurationSeconds}/${profile.burstDurationSeconds}`;
    const priority = profile.priority ? Math.min(8, Math.max(1, profile.priority)) : 8;

    let result = `${baseRate} ${burstRate} ${burstThreshold} ${burstTime} ${priority}`;

    if (profile.minUploadKbps && profile.minDownloadKbps) {
      result += ` ${Math.floor(profile.minUploadKbps)}k/${Math.floor(profile.minDownloadKbps)}k`;
    }

    return result;
  }

  return baseRate;
}
