import { useDawStore, type DawState } from './useDawStore';

export type DawSnapshot = Pick<
  DawState,
  | 'tracks'
  | 'playlistClips'
  | 'selectedPlaylistClipIds'
  | 'currentPatternId'
  | 'bpm'
  | 'isPlaying'
  | 'playheadPosition'
  | 'metronome'
  | 'loopActive'
  | 'loopStart'
  | 'loopEnd'
  | 'snapInterval'
  | 'lastNoteDuration'
  | 'selectedTrackId'
  | 'activeWindow'
  | 'isChannelRackOpen'
>;

export const createDawSnapshot = (state: DawState): DawSnapshot => ({
  tracks: state.tracks,
  playlistClips: state.playlistClips,
  selectedPlaylistClipIds: state.selectedPlaylistClipIds,
  currentPatternId: state.currentPatternId,
  bpm: state.bpm,
  isPlaying: state.isPlaying,
  playheadPosition: state.playheadPosition,
  metronome: state.metronome,
  loopActive: state.loopActive,
  loopStart: state.loopStart,
  loopEnd: state.loopEnd,
  snapInterval: state.snapInterval,
  lastNoteDuration: state.lastNoteDuration,
  selectedTrackId: state.selectedTrackId,
  activeWindow: state.activeWindow,
  isChannelRackOpen: state.isChannelRackOpen,
});

export const applyDawSnapshot = (snapshot: Partial<DawSnapshot>) => {
  const { history, future } = useDawStore.getState();
  useDawStore.setState({
    ...snapshot,
    history,
    future,
  });
};
