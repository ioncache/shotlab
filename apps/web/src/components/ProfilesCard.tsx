import { Button, Card, CardContent, Stack, Typography } from '@mui/material';
import type { MachineProfile } from '@shotlab/meticulous-client';
import { ProfileCarousel } from './ProfileCarousel';
import { ProfileDetails } from './ProfileDetails';

interface ProfilesCardProps {
  activeProfileId?: string;
  activeProfile?: MachineProfile;
  isLocked: boolean;
  machineBaseUrl?: string;
  onSelectProfile: (profileId: string) => void;
  profiles: MachineProfile[];
}

export function ProfilesCard(props: ProfilesCardProps) {
  return (
    <Card>
      <CardContent>
        <Stack spacing={3}>
          <Typography variant="h5">Profiles</Typography>
          <ProfileCarousel
            activeProfileId={props.activeProfileId}
            isLocked={props.isLocked}
            machineBaseUrl={props.machineBaseUrl}
            onSelectProfile={props.onSelectProfile}
            profiles={props.profiles}
          />
          <Button disabled variant="contained">
            Load profile
          </Button>
          <ProfileDetails profile={props.activeProfile} />
        </Stack>
      </CardContent>
    </Card>
  );
}
