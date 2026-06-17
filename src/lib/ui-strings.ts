export interface UiStrings {
  title: string;
  subtitle: string;
  chooseLanguage: string;
  playBulletin: string;
  listenAllStories: string;
  listenStory: string;
  radioMode: string;
  storiesMode: string;
  pause: string;
  stop: string;
  refresh: string;
  onAir: string;
  preparingBulletin: string;
  loadingNews: string;
  preparingNews: string;
  voiceNatural: string;
  voiceBrowser: string;
  voiceNotReady: string;
  nowPlaying: string;
  readyToPlay: string;
  storyLabel: string;
}

export function englishUi(introCount = 10): { ui: UiStrings; introText: string } {
  return {
    ui: {
      title: "Today's Top 10 News",
      subtitle: "India · Listen in your language",
      chooseLanguage: "Choose your language",
      playBulletin: "Play Full Bulletin",
      listenAllStories: "Listen to All Stories",
      listenStory: "Listen",
      radioMode: "Radio Bulletin",
      storiesMode: "Each Story",
      pause: "Pause",
      stop: "Stop",
      refresh: "Refresh",
      onAir: "ON AIR",
      preparingBulletin: "Preparing audio…",
      loadingNews: "Loading today's news…",
      preparingNews: "Preparing news…",
      voiceNatural: "Powered by Sarvam AI · Natural Indian voice",
      voiceBrowser: "Using browser voice",
      voiceNotReady: "Voice not ready. Add SARVAM_API_KEY to .env.local",
      nowPlaying: "Ready",
      readyToPlay: "Audio ready · tap play",
      storyLabel: "Story",
    },
    introText: `Here are today's top ${introCount} news from India.`,
  };
}

export const DEFAULT_UI = englishUi().ui;
