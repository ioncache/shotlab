import type {
  JsonObject,
  LastProfileResponse,
  MachineProfile,
  Settings,
} from '@shotlab/meticulous-client';

export interface ProfileBrowserState {
  activeProfile?: MachineProfile;
  activeProfileId?: string;
  isBrewing: boolean;
  orderedProfiles: MachineProfile[];
}

interface SelectProfileBrowserStateInput {
  lastProfile: LastProfileResponse;
  machine: JsonObject;
  profiles: MachineProfile[];
  selectedProfileId?: string;
  settings: Settings;
}

export function selectProfileBrowserState(
  input: SelectProfileBrowserStateInput,
): ProfileBrowserState {
  const orderedProfiles = orderProfiles(
    input.profiles,
    input.settings.profile_order,
  );
  const isBrewing = readIsBrewing(input.machine);
  const activeReference = isBrewing
    ? readActiveBrewProfileReference(input.machine, input.lastProfile)
    : (input.selectedProfileId ??
      readLoadedProfileReference(input.machine, input.lastProfile) ??
      readProfileId(orderedProfiles[0]));
  const activeProfile = activeReference
    ? findProfileByReference(orderedProfiles, activeReference)
    : orderedProfiles[0];

  return {
    activeProfile,
    activeProfileId: readProfileId(activeProfile),
    isBrewing,
    orderedProfiles,
  };
}

export function orderProfiles(
  profiles: MachineProfile[],
  profileOrder: Settings['profile_order'],
): MachineProfile[] {
  if (!Array.isArray(profileOrder) || profileOrder.length === 0) {
    return [...profiles];
  }

  const orderedProfiles: MachineProfile[] = [];
  const seenProfileIds = new Set<string>();

  for (const profileId of profileOrder) {
    const profile = findProfileByReference(profiles, profileId);
    const nextProfileId = readProfileId(profile);

    if (!profile || !nextProfileId || seenProfileIds.has(nextProfileId)) {
      continue;
    }

    seenProfileIds.add(nextProfileId);
    orderedProfiles.push(profile);
  }

  for (const profile of profiles) {
    const profileId = readProfileId(profile);

    if (!profileId || seenProfileIds.has(profileId)) {
      continue;
    }

    seenProfileIds.add(profileId);
    orderedProfiles.push(profile);
  }

  return orderedProfiles;
}

export function readProfileId(
  profile: MachineProfile | undefined,
): string | undefined {
  return readString(profile?.id);
}

export function readProfileName(profile: MachineProfile | undefined): string {
  return (
    readString(profile?.name) ??
    readString(profile?.id) ??
    'No profile selected'
  );
}

export function readProfileImage(
  profile: MachineProfile | undefined,
): string | undefined {
  return readString(profile?.display?.image);
}

export function readProfileDescription(
  profile: MachineProfile | undefined,
): string | undefined {
  return (
    readString(profile?.display?.description) ??
    readString(profile?.display?.shortDescription)
  );
}

export function findProfileIdByReference(
  profiles: MachineProfile[],
  reference: string | undefined,
): string | undefined {
  if (!reference) {
    return undefined;
  }

  return readProfileId(findProfileByReference(profiles, reference));
}

export function readIsBrewing(machine: JsonObject): boolean {
  const state = readString(
    machine.state,
    machine.current_state,
    machine.status,
    machine.name,
  )?.toLowerCase();

  if (!state) {
    return false;
  }

  return (
    state.includes('brew') || state === 'extraction' || state === 'retracting'
  );
}

function readActiveBrewProfileReference(
  machine: JsonObject,
  lastProfile: LastProfileResponse,
): string | undefined {
  return (
    readString(machine.profile, machine.loaded_profile) ??
    readProfileId(lastProfile.profile) ??
    readString(lastProfile.profile?.name)
  );
}

function readLoadedProfileReference(
  machine: JsonObject,
  lastProfile: LastProfileResponse,
): string | undefined {
  return (
    readString(machine.loaded_profile, machine.profile) ??
    readProfileId(lastProfile.profile) ??
    readString(lastProfile.profile?.name)
  );
}

function findProfileByReference(
  profiles: MachineProfile[],
  reference: string,
): MachineProfile | undefined {
  return profiles.find((profile) =>
    matchesProfileReference(profile, reference),
  );
}

function matchesProfileReference(
  profile: MachineProfile | undefined,
  reference: string,
): boolean {
  const normalizedReference = normalize(reference);

  return [profile?.id, profile?.name].some(
    (value) => normalize(value) === normalizedReference,
  );
}

function readString(...values: Array<unknown>): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function normalize(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}
