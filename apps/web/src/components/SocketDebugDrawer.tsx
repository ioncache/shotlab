import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Chip,
  Drawer,
  Stack,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { EmptyPanel } from './EmptyPanel';
import {
  type DebugSocketEventGroupSnapshot,
  type DebugSocketPacket,
  type DebugSocketSessionSnapshot,
  type DebugSocketSnapshot,
  formatDebugPayloadJson,
  formatDebugSocketRate,
} from '../lib/socket-debug';

const DEBUG_DRAWER_STORAGE_KEY = 'shotlab.debugDrawerOpen';

interface DebugSocketGroupSelection {
  eventName?: string;
  packetId?: string;
}

interface DebugSocketPacketSummaryProps {
  isSelected: boolean;
  onClick: () => void;
  packet: DebugSocketPacket;
}

interface DebugSocketGroupCardProps {
  group: DebugSocketEventGroupSnapshot;
  isSelected: boolean;
  onClick: () => void;
}

interface DebugSocketPacketListProps {
  packets: DebugSocketPacket[];
  selectedPacketId?: string;
  onSelectPacket: (packetId: string) => void;
}

interface DebugPayloadPanelProps {
  eventName?: string;
  packet?: DebugSocketPacket;
}

interface DebugSectionHeadingProps {
  title: string;
  caption?: string;
}

interface SocketDebugDrawerProps {
  socketDebug: DebugSocketSnapshot;
  socketSession: DebugSocketSessionSnapshot;
}

export function SocketDebugDrawer(props: SocketDebugDrawerProps) {
  const [debugDrawerOpen, setDebugDrawerOpen] = useState(() =>
    readStoredBoolean(DEBUG_DRAWER_STORAGE_KEY, false),
  );
  const [selection, setSelection] = useState<DebugSocketGroupSelection>({});

  useEffect(() => {
    writeStoredBoolean(DEBUG_DRAWER_STORAGE_KEY, debugDrawerOpen);
  }, [debugDrawerOpen]);

  useEffect(() => {
    if (!debugDrawerOpen) {
      setSelection({});
    }
  }, [debugDrawerOpen]);

  const selectedSocketGroup = props.socketSession.groups.find(
    (group) => group.event === selection.eventName,
  );
  const selectedSocketPacket =
    selectedSocketGroup?.recentPackets.find(
      (packet) => packet.id === selection.packetId,
    ) ?? selectedSocketGroup?.latestPacket;

  useEffect(() => {
    if (!debugDrawerOpen) {
      return;
    }

    if (props.socketSession.groups.length === 0) {
      if (selection.eventName || selection.packetId) {
        setSelection({});
      }
      return;
    }

    if (
      selection.eventName &&
      props.socketSession.groups.some(
        (group) => group.event === selection.eventName,
      )
    ) {
      return;
    }

    setSelection({
      eventName: props.socketSession.groups[0]?.event,
    });
  }, [
    debugDrawerOpen,
    props.socketSession.groups,
    selection.eventName,
    selection.packetId,
  ]);

  useEffect(() => {
    if (!debugDrawerOpen || !selectedSocketGroup) {
      return;
    }

    if (
      selection.packetId &&
      selectedSocketGroup.recentPackets.some(
        (packet) => packet.id === selection.packetId,
      )
    ) {
      return;
    }

    setSelection((current) => ({
      eventName: current.eventName ?? selectedSocketGroup.event,
      packetId: selectedSocketGroup.latestPacket?.id,
    }));
  }, [debugDrawerOpen, selectedSocketGroup, selection.packetId]);

  return (
    <>
      <Button
        onClick={() => setDebugDrawerOpen((current) => !current)}
        variant={debugDrawerOpen ? 'contained' : 'outlined'}
      >
        {debugDrawerOpen ? 'Hide debug' : 'Show debug'}
      </Button>
      <Drawer
        anchor="right"
        onClose={() => setDebugDrawerOpen(false)}
        open={debugDrawerOpen}
        slotProps={{
          paper: {
            sx: {
              flexShrink: 0,
              height: '100vh',
              maxHeight: '100vh',
              maxWidth: { sm: 440, xs: '100vw' },
              overflow: 'hidden',
              overflowX: 'hidden',
              width: { sm: 440, xs: '100vw' },
            },
          },
        }}
      >
        <Box
          sx={{
            height: '100%',
            maxWidth: '100%',
            minWidth: 0,
            px: 2,
            py: 2,
            width: '100%',
          }}
        >
          <Stack
            spacing={2}
            sx={{
              height: '100%',
              maxWidth: '100%',
              minHeight: 0,
              minWidth: 0,
              width: '100%',
            }}
          >
            <Stack
              direction="row"
              spacing={1.5}
              sx={{ alignItems: 'center', justifyContent: 'space-between' }}
            >
              <Typography variant="h5">Socket debug</Typography>
              <Button onClick={() => setDebugDrawerOpen(false)} variant="text">
                Close
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              <Chip
                color={readDebugChipColor(props.socketDebug.status)}
                label={`State: ${props.socketDebug.status}`}
                size="small"
              />
              <Chip
                label={`Transport: ${props.socketDebug.transport ?? 'unknown'}`}
                size="small"
              />
              <Chip
                label={`Events: ${props.socketSession.totalEvents}`}
                size="small"
              />
              <Chip
                label={`Groups: ${props.socketSession.groups.length}`}
                size="small"
              />
            </Stack>
            {props.socketDebug.socketId ? (
              <Typography color="text.secondary" variant="body2">
                Socket ID: {props.socketDebug.socketId}
              </Typography>
            ) : null}
            {props.socketDebug.error ? (
              <Alert severity="warning">{props.socketDebug.error}</Alert>
            ) : null}
            <Stack spacing={2} sx={{ flex: 1, minHeight: 0, minWidth: 0 }}>
              <Stack spacing={1} sx={{ flex: 1, minHeight: 0, minWidth: 0 }}>
                <DebugSectionHeading
                  caption={
                    props.socketSession.groups.length > 0
                      ? `${props.socketSession.groups.length} event groups`
                      : undefined
                  }
                  title="Event groups"
                />
                {props.socketSession.groups.length > 0 ? (
                  <Box
                    sx={{
                      border: '1px solid rgba(79, 122, 144, 0.25)',
                      borderRadius: 2,
                      flex: 1,
                      minHeight: 0,
                      minWidth: 0,
                      overflowY: 'auto',
                      p: 1,
                    }}
                  >
                    <Stack spacing={1}>
                      {props.socketSession.groups.map((group) => (
                        <DebugSocketGroupCard
                          group={group}
                          isSelected={
                            group.event === selectedSocketGroup?.event
                          }
                          key={group.event}
                          onClick={() =>
                            setSelection({ eventName: group.event })
                          }
                        />
                      ))}
                    </Stack>
                  </Box>
                ) : (
                  <EmptyPanel text="No socket events captured yet." />
                )}
              </Stack>
              <Stack
                spacing={1}
                sx={{
                  borderTop: '1px solid rgba(79, 122, 144, 0.15)',
                  minHeight: 0,
                  minWidth: 0,
                  pt: 2,
                }}
              >
                <DebugSectionHeading
                  caption={
                    selectedSocketGroup
                      ? `${selectedSocketGroup.recentPackets.length} recent packets kept`
                      : undefined
                  }
                  title={
                    selectedSocketGroup
                      ? `Recent ${selectedSocketGroup.event} packets`
                      : 'Recent packets'
                  }
                />
                {selectedSocketGroup ? (
                  <DebugSocketPacketList
                    onSelectPacket={(packetId) =>
                      setSelection((current) => ({
                        eventName: current.eventName,
                        packetId,
                      }))
                    }
                    packets={selectedSocketGroup.recentPackets}
                    selectedPacketId={selectedSocketPacket?.id}
                  />
                ) : (
                  <EmptyPanel text="Select an event group to inspect its recent packets." />
                )}
              </Stack>
              <Stack
                spacing={1}
                sx={{
                  borderTop: '1px solid rgba(79, 122, 144, 0.15)',
                  minHeight: 0,
                  minWidth: 0,
                  pt: 2,
                }}
              >
                <DebugSectionHeading title="Selected payload" />
                <DebugPayloadPanel
                  eventName={selectedSocketGroup?.event}
                  packet={selectedSocketPacket}
                />
              </Stack>
            </Stack>
          </Stack>
        </Box>
      </Drawer>
    </>
  );
}

function DebugSectionHeading(props: DebugSectionHeadingProps) {
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: 'center', justifyContent: 'space-between' }}
    >
      <Typography variant="h6">{props.title}</Typography>
      {props.caption ? (
        <Typography color="text.secondary" variant="caption">
          {props.caption}
        </Typography>
      ) : null}
    </Stack>
  );
}

function DebugSocketGroupCard(props: DebugSocketGroupCardProps) {
  return (
    <ButtonBase
      onClick={props.onClick}
      sx={{
        border: '1px solid',
        borderColor: props.isSelected
          ? 'primary.main'
          : 'rgba(79, 122, 144, 0.2)',
        borderRadius: 2,
        cursor: 'pointer',
        minWidth: 0,
        px: 1.25,
        py: 1,
        textAlign: 'left',
        width: '100%',
      }}
    >
      <Stack spacing={0.5}>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Typography sx={{ fontWeight: 600 }} variant="body2">
            {props.group.event}
          </Typography>
          <Typography color="text.secondary" variant="caption">
            {props.group.totalCount} events
          </Typography>
        </Stack>
        <Typography color="text.secondary" variant="caption">
          {props.group.latestPacket?.receivedAt ?? 'No packets yet'}
          {props.group.latestPacket?.rawMachineTime
            ? ` | raw machine time: ${props.group.latestPacket.rawMachineTime}`
            : ''}
        </Typography>
        <Typography color="text.secondary" variant="caption">
          {formatDebugSocketRate(props.group.recentRatePerSecond)}
        </Typography>
        <Typography
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          variant="body2"
        >
          {props.group.payloadPreview}
        </Typography>
      </Stack>
    </ButtonBase>
  );
}

function DebugSocketPacketList(props: DebugSocketPacketListProps) {
  return (
    <Box
      sx={{
        border: '1px solid rgba(79, 122, 144, 0.25)',
        borderRadius: 2,
        height: 180,
        minHeight: 180,
        minWidth: 0,
        overflowY: 'auto',
        p: 1,
      }}
    >
      <Stack spacing={1}>
        {props.packets.map((packet) => (
          <DebugSocketPacketSummary
            isSelected={packet.id === props.selectedPacketId}
            key={packet.id}
            onClick={() => props.onSelectPacket(packet.id)}
            packet={packet}
          />
        ))}
      </Stack>
    </Box>
  );
}

function DebugSocketPacketSummary(props: DebugSocketPacketSummaryProps) {
  return (
    <ButtonBase
      onClick={props.onClick}
      sx={{
        border: '1px solid',
        borderColor: props.isSelected
          ? 'primary.main'
          : 'rgba(79, 122, 144, 0.2)',
        borderRadius: 2,
        cursor: 'pointer',
        px: 1.25,
        py: 1,
        textAlign: 'left',
        width: '100%',
      }}
    >
      <Typography variant="body2">{props.packet.receivedAt}</Typography>
      <Typography color="text.secondary" variant="caption">
        {props.packet.rawMachineTime
          ? `raw machine time: ${props.packet.rawMachineTime}`
          : 'raw machine time unavailable'}
      </Typography>
    </ButtonBase>
  );
}

function DebugPayloadPanel(props: DebugPayloadPanelProps) {
  return (
    <Box
      sx={{
        backgroundColor: 'rgba(20, 28, 36, 0.04)',
        borderRadius: 2,
        height: 220,
        maxWidth: '100%',
        minWidth: 0,
        overflow: 'hidden',
        p: 1,
        width: '100%',
      }}
    >
      {props.packet ? (
        <Box
          sx={{
            fontFamily: 'monospace',
            height: '100%',
            m: 0,
            maxWidth: '100%',
            minWidth: 0,
            overflowX: 'auto',
            overflowY: 'auto',
            p: 2,
            whiteSpace: 'pre-wrap',
            width: '100%',
            wordBreak: 'break-word',
          }}
        >
          {formatDebugPayloadJson({
            event: props.eventName,
            payload: props.packet.payload,
            rawMachineTime: props.packet.rawMachineTime,
            receivedAt: props.packet.receivedAt,
          })}
        </Box>
      ) : (
        <Box sx={{ height: '100%', width: '100%' }}>
          <EmptyPanel text="Select a packet to inspect its payload." />
        </Box>
      )}
    </Box>
  );
}

function readDebugChipColor(
  status: DebugSocketSnapshot['status'],
): 'default' | 'error' | 'success' | 'warning' {
  switch (status) {
    case 'connected':
      return 'success';
    case 'connecting':
    case 'disconnected':
      return 'warning';
    case 'error':
      return 'error';
    default:
      return 'default';
  }
}

function readStoredBoolean(key: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const value = window.localStorage.getItem(key);
    if (value === '1') {
      return true;
    }
    if (value === '0') {
      return false;
    }
  } catch {
    return fallback;
  }

  return fallback;
}

function writeStoredBoolean(key: string, value: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(key, value ? '1' : '0');
  } catch {
    return;
  }
}
