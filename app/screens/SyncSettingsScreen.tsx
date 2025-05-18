import React, { FC, useEffect, useState } from "react"
import { observer } from "mobx-react-lite"
import {
  Alert,
  BackHandler,
  Pressable,
  ViewStyle,
  Dimensions,
  StyleSheet,
  Vibration,
} from "react-native"
import { AppStackScreenProps } from "app/navigators"
import { Screen, Text, View } from "app/components"
import { SyncServer } from "app/utils/sync"
import { colors } from "app/theme"
import { getHHApiUrl } from "app/utils/storage"
import { v1 as uuidV1 } from "uuid"
import { ServerType } from "app/types"
import { LucideCamera } from "lucide-react-native"
import { CameraView, CameraType, useCameraPermissions, BarcodeScanningResult } from "expo-camera"
import { translate } from "app/i18n"
// import { useNavigation } from "@react-navigation/native"
// import { useStores } from "app/models"

const { width, height } = Dimensions.get("window")

/**
 * Hook to get the current servers that have been configured
 * @returns {servers: SyncServer.T[], setServers: (servers: SyncServer.T[]) => void, refresh: () => Promise<void>}
 */
function useSyncServerDetails() {
  const [servers, setServers] = React.useState<SyncServer.T[]>([])

  function getDetails() {
    return SyncServer.getAll()
      .then((servers) => setServers(Object.values(servers)))
      .catch((error) => {
        console.error(error)
        setServers([])
      })
  }

  useEffect(() => {
    getDetails()
  }, [])

  return { servers, setServers, refresh: getDetails }
}

interface SyncSettingsScreenProps extends AppStackScreenProps<"SyncSettings"> {}

export const SyncSettingsScreen: FC<SyncSettingsScreenProps> = observer(
  function SyncSettingsScreen() {
    // const navigation = useNavigation()
    const [isCameraScannerActive, setIsCameraScannerActive] = useState(false)
    const [facing, setFacing] = useState<CameraType>("back")
    const [permission, requestPermission] = useCameraPermissions()

    const { servers, refresh } = useSyncServerDetails()

    /**
     * Cold start problem: remote server is not set up as this feature is being introduced. It exists in the encrypted storage
     */
    useEffect(() => {
      const checkAndSetCloudServer = async () => {
        const existingServers = await SyncServer.getAll()
        const hasCloudServer = Object.values(existingServers).some(
          (server) => server.type === "cloud",
        )

        if (!hasCloudServer) {
          const url = await getHHApiUrl()
          if (url) {
            await SyncServer.set("cloud", {
              id: uuidV1(),
              name: "cloud",
              url,
              isActive: true,
              type: "cloud",
            })

            await refresh()
          }
        }
      }

      checkAndSetCloudServer()
    }, [])

    // on back press of the phone, close the camera, if camera is closed, go back
    useEffect(() => {
      const backAction = () => {
        if (isCameraScannerActive) {
          setIsCameraScannerActive(false)
          return true
        }
        return false
      }

      const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction)

      return () => {
        backHandler.remove()
      }
    }, [isCameraScannerActive])

    // whether or not there exists a local sync server
    const hasLocalServer = servers.some((server) => server.type === "local")

    const handleAddLocalServer = async () => {
      const { status } = await requestPermission()
      console.log("status", status)
      if (status === "granted") {
        setIsCameraScannerActive(true)
      } else {
        Alert.alert(translate("login:requiredCameraPermissions"))
      }
    }

    const handleBarCodeScanned = async ({ data }: BarcodeScanningResult) => {
      try {
        await SyncServer.set("local", {
          id: uuidV1(),
          name: "local",
          url: data,
          isActive: false,
          type: "local",
        })
        await refresh()

        Vibration.vibrate(500)

        // FIXME: Check that the scanned data is valid
      } catch (error) {
        console.error(error)
        Alert.alert(translate("login:invalidQRCode"))
      }
      setIsCameraScannerActive(false)
    }

    const handleCameraScanClose = () => {
      setIsCameraScannerActive(false)
    }

    const handleSetActiveServer = (type: ServerType) => {
      Alert.alert(
        translate("syncSettingsScreen:confirmSetDefault"),
        translate("syncSettingsScreen:confirmSetDefaultDescription"),
        [
          { text: translate("common:cancel"), style: "cancel" },
          {
            text: translate("common:confirm"),
            onPress: () => {
              SyncServer.setActive(type)
                .then(() => refresh())
                .catch((error) => {
                  console.error(error)
                  Alert.alert(translate("syncSettingsScreen:syncError"))
                })
            },
          },
        ],
      )
    }

    const handleAddServer = (type: ServerType) => {
      if (type === "local") {
        handleAddLocalServer()
      }
    }

    const cloudServer = servers.find((server) => server.type === "cloud")
    const localServer = servers.find((server) => server.type === "local")

    if (isCameraScannerActive && permission?.granted) {
      return (
        <View style={{ height, width }}>
          <CameraView
            barcodeScannerSettings={{
              barcodeTypes: ["qr"],
            }}
            facing={facing}
            onBarcodeScanned={handleBarCodeScanned}
            style={StyleSheet.absoluteFillObject}
          />
        </View>
      )
    }

    return (
      <Screen style={$root} preset="scroll">
        <Text size="lg" text="Configured Servers" />

        {cloudServer && (
          <ServerTypeComponent
            handleAddServer={handleAddServer}
            handleSetActiveServer={handleSetActiveServer}
            server={cloudServer}
          />
        )}

        {localServer && (
          <ServerTypeComponent
            handleAddServer={handleAddServer}
            handleSetActiveServer={handleSetActiveServer}
            server={localServer}
          />
        )}

        {!hasLocalServer && (
          <View style={$withBottomBorder} py={12} direction="column" gap={4}>
            <View>
              <Text text="Local Server" size="md" />
              <Text text="Not Configured" size="xxs" />
            </View>

            <ConnectButton onPress={handleAddLocalServer} mode="connect" />
          </View>
        )}
      </Screen>
    )
  },
)

/**
 * Connect button
 * @param {Function} onPress - The function to call when the button is pressed
 * @param {"connect" | "change"} mode - The mode of the button
 * @returns {JSX.Element} The connect button
 */
function ConnectButton({ onPress, mode }: { onPress: () => void; mode: "connect" | "change" }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <LucideCamera color={colors.palette.primary600} size={20} />
      <Text
        text={mode === "connect" ? "Connect" : "Change"}
        size="xxs"
        color={colors.palette.primary600}
      />
    </Pressable>
  )
}

/**
 * Server type component
 * @param {SyncServer.T} server - The server to display
 * @param {Function} handleSetActiveServer - The function to call when the server is set as active
 * @returns {JSX.Element} The server type component
 */
function ServerTypeComponent({
  server,
  handleSetActiveServer,
  handleAddServer,
}: {
  server: SyncServer.T
  handleSetActiveServer: (type: ServerType) => void
  handleAddServer: (type: ServerType) => void
}) {
  return (
    <View style={$withBottomBorder} py={12} direction="column" gap={4}>
      <View direction="row" gap={4} justifyContent="space-between">
        <Text text={getServerDisplayName(server.type)} size="md" />
        {server.isActive && <ActiveBadge isDefault={server.isActive} />}
      </View>
      <Text text={server.url} size="xxs" />

      <View direction="row" gap={4} justifyContent="space-between">
        {!server.isActive && (
          <Pressable onPress={() => handleSetActiveServer(server.type)} hitSlop={10}>
            <View
              style={{ backgroundColor: colors.palette.neutral200, borderRadius: 6, padding: 4 }}
            >
              <Text
                size="xs"
                color={colors.palette.primary700}
                text="Make Default"
                textDecorationLine="underline"
              />
            </View>
          </Pressable>
        )}

        {server.type === "local" && (
          <ConnectButton onPress={() => handleAddServer(server.type)} mode="change" />
        )}
      </View>
    </View>
  )
}

function ActiveBadge({ isDefault }: { isDefault: boolean }) {
  return (
    <View
      style={{
        backgroundColor: colors.palette.neutral300,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
      }}
    >
      <Text text={isDefault ? "Active" : "Inactive"} size="xs" />
    </View>
  )
}

/**
 * Given a server type, return the display name
 * @param {ServerType} type - The type of server
 * @returns {string} The display name of the server
 */
const getServerDisplayName = (type: ServerType): string => {
  switch (type) {
    case "local":
      return "Local Server"
    case "cloud":
      return "Cloud Server"
    default:
      return "Unknown Server"
  }
}

const $root: ViewStyle = {
  flex: 1,
  paddingHorizontal: 14,
}

const $withBottomBorder: ViewStyle = {
  borderBottomColor: colors.border,
  borderBottomWidth: 1,
}
