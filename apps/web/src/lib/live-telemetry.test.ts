import { describe, expect, it } from 'vitest';
import type { LastProfileResponse } from '@shotlab/meticulous-client';
import { applyLiveSocketEvent } from './live-telemetry';

describe('applyLiveSocketEvent', () => {
  it('builds a live shot from status events that only expose profile_time and sensors', () => {
    const lastProfile: LastProfileResponse = {};

    const nextState = applyLiveSocketEvent({
      event: {
        event: 'status',
        payload: [
          {
            extracting: true,
            profile_time: 9.2,
            sensors: { p: 7.9, t: 91.4, w: 15.3 },
            state: 'brewing',
            time: 22.4,
          },
        ],
      },
      lastProfile,
      liveShot: undefined,
      machine: {},
      settings: {},
    });

    expect(nextState.liveShot).toMatchObject({
      durationSeconds: 0.0092,
      points: [
        {
          flow: null,
          gravimetricFlow: null,
          pressure: 7.9,
          second: 0.0092,
          temperatureCelsius: 91.4,
          weight: 15.3,
        },
      ],
      source: 'live',
      yieldGrams: 15.3,
    });
  });

  it('keeps the existing live shot when a later status event is non-brewing', () => {
    const lastProfile: LastProfileResponse = {};

    const brewingState = applyLiveSocketEvent({
      event: {
        event: 'status',
        payload: [
          {
            extracting: true,
            profile_time: 9.2,
            sensors: { p: 7.9, t: 91.4, w: 15.3 },
            state: 'brewing',
            time: 22.4,
          },
        ],
      },
      lastProfile,
      liveShot: undefined,
      machine: {},
      settings: {},
    });

    const idleState = applyLiveSocketEvent({
      event: {
        event: 'status',
        payload: [
          {
            name: 'Idle',
            state: 'idle',
            time: 0,
          },
        ],
      },
      lastProfile,
      liveShot: brewingState.liveShot,
      machine: {},
      settings: {},
    });

    expect(idleState.liveShot).toEqual(brewingState.liveShot);
  });

  it('does not create a live shot from idle status packets that still include profile_time', () => {
    const lastProfile: LastProfileResponse = {};

    const nextState = applyLiveSocketEvent({
      event: {
        event: 'status',
        payload: [
          {
            name: 'Idle',
            profile_time: 6903,
            sensors: { p: 0.35, t: 92.4, w: 7.6 },
            state: 'idle',
            status: 'Idle',
            time: 0,
          },
        ],
      },
      lastProfile,
      liveShot: undefined,
      machine: {},
      settings: {},
    });

    expect(nextState.liveShot).toBeUndefined();
  });

  it('does not keep mutating a finished live shot from idle sensors traffic', () => {
    const lastProfile: LastProfileResponse = {};

    const brewingState = applyLiveSocketEvent({
      event: {
        event: 'status',
        payload: [
          {
            extracting: true,
            profile_time: 9.2,
            sensors: { p: 7.9, t: 91.4, w: 15.3 },
            state: 'brewing',
            time: 22.4,
          },
        ],
      },
      lastProfile,
      liveShot: undefined,
      machine: {},
      settings: {},
    });

    const idleSensorsState = applyLiveSocketEvent({
      event: {
        event: 'sensors',
        payload: [{ weight_pred: 18.2 }],
      },
      lastProfile,
      liveShot: brewingState.liveShot,
      machine: { state: 'idle' },
      settings: {},
    });

    expect(idleSensorsState.liveShot).toEqual(brewingState.liveShot);
  });

  it('uses a live-brew fallback title when the machine timestamp is zero', () => {
    const lastProfile: LastProfileResponse = {};

    const nextState = applyLiveSocketEvent({
      event: {
        event: 'status',
        payload: [
          {
            extracting: true,
            profile_time: 9.2,
            sensors: { p: 7.9, t: 91.4, w: 15.3 },
            state: 'brewing',
            time: 0,
          },
        ],
      },
      lastProfile,
      liveShot: undefined,
      machine: {},
      settings: {},
    });

    expect(nextState.liveShot?.brewedAt).toBe('Live brew');
  });

  it('updates the live shot profile id from a later profile load event', () => {
    const nextState = applyLiveSocketEvent({
      event: {
        event: 'profile',
        payload: [{ change: 'load', profile_id: 'new-profile' }],
      },
      lastProfile: {
        profile: {
          display: { image: '/profiles/new.png' },
          id: 'old-profile',
          name: 'New profile',
        },
      },
      liveShot: {
        brewedAt: 'Live brew',
        doseGrams: null,
        durationSeconds: 1,
        id: 'live-shot',
        points: [
          {
            flow: 1,
            gravimetricFlow: 1,
            pressure: 8,
            second: 1,
            temperatureCelsius: 93,
            weight: 10,
          },
        ],
        profile: 'Old profile',
        profileId: 'old-profile',
        profileImage: '/profiles/old.png',
        source: 'live',
        yieldGrams: 10,
      },
      machine: {},
      settings: {},
    });

    expect(nextState.liveShot).toMatchObject({
      profile: 'New profile',
      profileId: 'new-profile',
      profileImage: '/profiles/new.png',
    });
  });
});
