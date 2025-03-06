import React, { FC, useEffect, useState } from "react"
import { observer } from "mobx-react-lite"
import {
  Button,
  ViewStyle,
  Dimensions,
  Pressable,
  StyleSheet,
  BackHandler,
  TextStyle,
  Alert,
} from "react-native"
import { CameraView, CameraType, useCameraPermissions, BarcodeScanningResult } from "expo-camera"
import { AppStackScreenProps } from "app/navigators"
import { Screen, Text, View } from "app/components"
import Toast from "react-native-root-toast"
import { multiply, useP2PCommunication, getAllPairedDevices, createRouter } from "rn-local-p2p"
import type { PairingInfo, Device, StorageLayer } from "rn-local-p2p"
import QRCode from "react-native-qrcode-svg"
import AsyncStorage from "@react-native-async-storage/async-storage"
import type { CallbackWithResult } from "@react-native-async-storage/async-storage"
import { colors } from "app/theme"
import { RefreshCwIcon, TrashIcon, XIcon } from "lucide-react-native"
import { useStores } from "app/models"
// import { useNavigation } from "@react-navigation/native"
// import { useStores } from "app/models"

const WIDTH = Dimensions.get("window").width

interface DevicePairingScreenProps extends AppStackScreenProps<"DevicePairing"> {}

export const DevicePairingScreen: FC<DevicePairingScreenProps> = observer(
  function DevicePairingScreen() {
    // Pull in one of our MST stores
    const { provider } = useStores()

    // Pull in navigation via hook
    // const navigation = useNavigation()

    const [cameraActive, setCameraActive] = useState<boolean>(false)
    const [facing, setFacing] = useState<CameraType>("back")
    const [permission, requestPermission] = useCameraPermissions()
    const [scanned, setScanned] = useState(false)

    const handleBarCodeScanned = async ({ data }: BarcodeScanningResult) => {
      setScanned(true)
      setCameraActive(false)

      scanQRCode(data)
    }

    const openCamera = () => {
      setScanned(false)
      setCameraActive(true)
    }

    // Create router
    const router = createRouter()

    const [
      { myIpAddress, qrCode, pairedDevices },
      { generateQRCode, scanQRCode, removePairedDevice, sendRequest },
    ] = useP2PCommunication({
      router,
      storage: AsyncStorage as any as StorageLayer,
      port: 12345,
      password: "password",
      salt: "salt",
    })

    useEffect(() => {
      // generateQRCode()
      // getAllPairedDevices(AsyncStorage as any as StorageLayer).then((res) => console.log({ res }))
    }, [])

    useEffect(() => {
      const backAction = () => {
        if (cameraActive) {
          setCameraActive(false)
          return true
        }
        return false
      }

      const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction)

      return () => backHandler.remove()
    }, [cameraActive])

    const handleGenerateQRCode = () => {
      const extraData = provider
        ? {
            name: provider.name,
            email: provider.email,
            phone: provider.phone,
            role: provider.role,
            clinic: provider.clinic,
            clinic_id: provider.clinic_id,
          }
        : {}

      console.log({ extraData })
      generateQRCode(extraData).then((res) =>
        Toast.show("✅ QR Code generated", {
          position: Toast.positions.BOTTOM,
          containerStyle: { marginBottom: 80 },
        }),
      )
    }

    const handleRemovePairedDevice = (device: Device) => {
      Alert.alert(
        "Remove Device",
        `Are you sure you want to remove ${device.name || "this device"}?`,
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Remove",
            style: "destructive",
            onPress: () => {
              removePairedDevice(device.id)
                .then(() => {
                  Toast.show("✅ Device removed", {
                    position: Toast.positions.BOTTOM,
                    containerStyle: { marginBottom: 80 },
                  })
                })
                .catch((err) => {
                  Toast.show("❌ Error removing device", {
                    position: Toast.positions.BOTTOM,
                    containerStyle: { marginBottom: 80 },
                  })
                  console.log(err)
                })
            },
          },
        ],
      )
    }

    console.log({ myIpAddress, qrCode, pairedDevices })

    if (cameraActive && permission?.granted) {
      return (
        <View style={{ flex: 1 }}>
          <CameraView
            barcodeScannerSettings={{
              barcodeTypes: ["qr"],
            }}
            facing={facing}
            onBarcodeScanned={(barcode) => (scanned ? undefined : handleBarCodeScanned(barcode))}
            style={StyleSheet.absoluteFillObject}
          />
        </View>
      )
    }

    return (
      <Screen style={$root} preset="scroll">
        {qrCode ? (
          <View px={12} py={22} alignItems="center" justifyContent="center">
            <QRCode value={qrCode} size={WIDTH - 24} />
            <Pressable
              onPress={handleGenerateQRCode}
              style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 8 }}
            >
              <RefreshCwIcon size={24} color={colors.palette.primary600} />
              <Text color={colors.palette.primary400}>Refresh QR Code</Text>
            </Pressable>
          </View>
        ) : (
          <View alignItems="center" justifyContent="center" py={20}>
            <Text text="No QR code generated yet" />
            <Button onPress={handleGenerateQRCode} title="Generate New QR Code" />
          </View>
        )}

        {pairedDevices.length > 0 && (
          <View pb={22}>
            <Text size="md" weight="bold" text={`Paired Devices (${pairedDevices.length})`} />
            {pairedDevices.map((device, ix) => (
              <DeviceListItem
                key={ix}
                device={device}
                onPress={() => {}}
                onRemove={() => handleRemovePairedDevice(device)}
              />
            ))}
          </View>
        )}

        <Button onPress={openCamera} title="Scan QR Code" />

        <View style={{ height: 160 }} />
      </Screen>
    )
  },
)

/**
 * Single Device List item
 */
function DeviceListItem({
  device,
  onPress,
  onRemove,
}: {
  device: Device
  onPress: () => void
  onRemove: () => void
}) {
  return (
    <Pressable onPress={onPress} style={$deviceItem}>
      <View style={$deviceInfo}>
        <Text style={$deviceName} text={device?.name || "Unknown Device"} />
        <Text style={$deviceIp} text={device?.pairingInfo.ipAddress || "No IP"} />
      </View>
      <Pressable onPress={onRemove} style={$removeButton}>
        <XIcon size={16} color={colors.palette.neutral100} />
      </Pressable>
    </Pressable>
  )
}

const $deviceItem: ViewStyle = {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  padding: 16,
  borderBottomWidth: 1,
  borderBottomColor: colors.separator,
}

const $deviceInfo: ViewStyle = {
  flex: 1,
}

const $deviceName: TextStyle = {
  fontSize: 16,
  fontWeight: "bold",
  color: colors.text,
}

const $deviceIp: TextStyle = {
  fontSize: 14,
  color: colors.textDim,
  marginTop: 4,
}

const $removeButton: ViewStyle = {
  backgroundColor: colors.error,
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: 4,
}

const $root: ViewStyle = {
  flex: 1,
  padding: 10,
}
