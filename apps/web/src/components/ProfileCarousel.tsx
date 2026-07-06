import { Box, ButtonBase, Stack, Typography } from '@mui/material';
import type { MachineProfile } from '@shotlab/meticulous-client';
import { useEffect, useMemo, useRef } from 'react';
import { Mousewheel } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperClass } from 'swiper/types';
import 'swiper/css';
import 'swiper/css/mousewheel';
import { resolveMachineAssetUrl } from '../lib/dashboard-display';
import {
  readProfileId,
  readProfileImage,
  readProfileName,
} from '../lib/profile-display';
import { ProfileDefaultIcon } from './ProfileDefaultIcon';

const PROFILE_ROW_HEIGHT = 64;
const PROFILE_ROW_GAP = 12;
const PROFILE_CAROUSEL_HEIGHT = PROFILE_ROW_HEIGHT * 3 + PROFILE_ROW_GAP * 2;

interface ProfileCarouselProps {
  activeProfileId?: string;
  isLocked: boolean;
  machineBaseUrl?: string;
  onSelectProfile: (profileId: string) => void;
  profiles: MachineProfile[];
}

export function ProfileCarousel(props: ProfileCarouselProps) {
  const swiperRef = useRef<SwiperClass | null>(null);
  const activeProfileIndex = useMemo(
    () =>
      props.profiles.findIndex(
        (profile) => readProfileId(profile) === props.activeProfileId,
      ),
    [props.activeProfileId, props.profiles],
  );
  const canLoop = props.profiles.length > 3;

  useEffect(() => {
    if (!swiperRef.current || activeProfileIndex < 0) {
      return;
    }

    if (canLoop) {
      swiperRef.current.slideToLoop(activeProfileIndex, 200);
      return;
    }

    swiperRef.current.slideTo(activeProfileIndex, 200);
  }, [activeProfileIndex, canLoop]);

  useEffect(() => {
    if (!swiperRef.current?.mousewheel) {
      return;
    }

    if (props.isLocked) {
      swiperRef.current.mousewheel.disable();
      return;
    }

    swiperRef.current.mousewheel.enable();
  }, [props.isLocked]);

  if (props.profiles.length === 0) {
    return (
      <Box
        sx={{
          alignItems: 'center',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          display: 'flex',
          minHeight: 180,
          px: 2,
        }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <ProfileDefaultIcon active label="No profile selected" />
          <Typography variant="body1">No profile selected</Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        '& .swiper': {
          height: '100%',
        },
        '& .swiper-slide': {
          alignItems: 'stretch',
          display: 'flex',
          height: `${PROFILE_ROW_HEIGHT}px !important`,
        },
        height: PROFILE_CAROUSEL_HEIGHT,
        overflow: 'hidden',
      }}
    >
      <Swiper
        centeredSlides
        centerInsufficientSlides
        direction="vertical"
        loop={canLoop}
        modules={[Mousewheel]}
        mousewheel={{
          enabled: true,
          forceToAxis: true,
          releaseOnEdges: true,
        }}
        onSlideChange={(swiper) => {
          if (props.isLocked) {
            return;
          }

          const nextProfile = props.profiles[swiper.realIndex];
          const nextProfileId = readProfileId(nextProfile);

          if (nextProfileId) {
            props.onSelectProfile(nextProfileId);
          }
        }}
        onSwiper={(swiper) => {
          swiperRef.current = swiper;
          if (props.isLocked) {
            swiper.mousewheel.disable();
          }
        }}
        allowTouchMove={!props.isLocked}
        slideToClickedSlide={!props.isLocked}
        slidesPerView={3}
        spaceBetween={12}
        style={{ height: '100%' }}
      >
        {props.profiles.map((profile, index) => {
          const profileId = readProfileId(profile) ?? readProfileName(profile);
          const profileName = readProfileName(profile);
          const isActive = profileId === props.activeProfileId;
          const profileImage = readProfileImage(profile);

          return (
            <SwiperSlide key={`${profileId ?? 'profile'}-${index}`}>
              <ButtonBase
                aria-label={`Select ${profileName} profile`}
                disabled={props.isLocked}
                onClick={() => {
                  if (!props.isLocked && profileId) {
                    props.onSelectProfile(profileId);
                  }
                }}
                sx={{
                  border: '1px solid',
                  borderColor: isActive ? 'primary.main' : 'divider',
                  borderRadius: 2,
                  display: 'block',
                  height: '100%',
                  opacity: isActive ? 1 : 0.55,
                  px: 1.5,
                  py: 1.25,
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <Stack
                  direction="row"
                  spacing={1.5}
                  sx={{ alignItems: 'center' }}
                >
                  {profileImage ? (
                    <Box
                      alt={`${profileName} profile image`}
                      component="img"
                      src={resolveMachineAssetUrl(
                        props.machineBaseUrl,
                        profileImage,
                      )}
                      sx={{
                        borderRadius: 1.5,
                        display: 'block',
                        filter: isActive ? 'none' : 'grayscale(1)',
                        flexShrink: 0,
                        height: 44,
                        objectFit: 'cover',
                        width: 44,
                      }}
                    />
                  ) : (
                    <ProfileDefaultIcon active={isActive} label={profileName} />
                  )}
                  <Typography noWrap variant="body1">
                    {profileName}
                  </Typography>
                </Stack>
              </ButtonBase>
            </SwiperSlide>
          );
        })}
      </Swiper>
    </Box>
  );
}
