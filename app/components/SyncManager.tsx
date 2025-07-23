import * as React from "react"
import { StyleProp, TextStyle, View, ViewStyle } from "react-native"
import { observer } from "mobx-react-lite"
import { createRouter, StorageLayer, useP2PCommunication } from "rn-local-p2p"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useNetInfo } from "@react-native-community/netinfo"
import { useEffect, useState } from "react"
import PatientModel from "app/db/model/Patient"
import { Q } from "@nozbe/watermelondb"
import db from "app/db"
import PatientAdditionalAttribute from "app/db/model/PatientAdditionalAttribute"
import { PatientRecord } from "app/types"
import { api } from "app/services/api"
import { patientApi } from "app/services/api/patientApi"
import RegistrationFormModel from "app/db/model/PatientRegistrationForm"
import { initialFormState } from "app/hooks/usePatientRegistrationForm"

// Key for storing received patient IDs in AsyncStorage
const RECEIVED_PATIENTS_KEY = "RECEIVED_PATIENTS_IDS"
// Maximum number of patient IDs to store before cleaning up
const MAX_STORED_PATIENT_IDS = 100
// Time in milliseconds after which a patient ID is considered stale (default: 24 hours)
const PATIENT_ID_EXPIRY_TIME = 24 * 60 * 60 * 1000

// Helper function to add a patient ID to the received patients list
const addReceivedPatientId = async (patientId: string) => {
  console.log("SSSS: Adding received patient ID", patientId)
  try {
    const existingIds = await AsyncStorage.getItem(RECEIVED_PATIENTS_KEY)
    let receivedIds: Array<{ id: string; timestamp: number }> = []

    // Safely parse the JSON, handling potential parsing errors
    try {
      receivedIds = existingIds ? JSON.parse(existingIds) : []
    } catch (parseError) {
      console.error("Error parsing received patients list:", parseError)
      // If parsing fails, start with a fresh array
      receivedIds = []
    }

    console.log("SSSS: Received IDs", receivedIds)

    // Check if the patient ID already exists in the list
    const patientExists = receivedIds.some((entry) => entry.id === patientId)

    if (!patientExists) {
      // Store the patient ID along with a timestamp
      receivedIds.push({
        id: patientId,
        timestamp: Date.now(),
      })

      // Clean up if the list is getting too large
      if (receivedIds.length > MAX_STORED_PATIENT_IDS) {
        await cleanupReceivedPatients()
      } else {
        await AsyncStorage.setItem(RECEIVED_PATIENTS_KEY, JSON.stringify(receivedIds))
      }

      console.log("SSSS: Added received patient ID", patientId)

      console.log(`Added patient ID ${patientId} to received patients list`)
    } else {
      console.log(`Patient ID ${patientId} already exists in received list, skipping addition`)
    }
  } catch (error) {
    console.error("Error adding patient ID to received list:", error)
  }
}

// Helper function to check if a patient ID was received from another device
const isReceivedPatient = async (patientId: string): Promise<boolean> => {
  try {
    const existingIds = await AsyncStorage.getItem(RECEIVED_PATIENTS_KEY)
    if (!existingIds) return false

    let receivedIds: Array<{ id: string; timestamp: number } | string> = []

    // Safely parse the JSON, handling potential parsing errors
    try {
      receivedIds = JSON.parse(existingIds)
    } catch (parseError) {
      console.error("Error parsing received patients list:", parseError)
      return false
    }

    // Check if the patient ID exists in the list (handling both old and new formats)
    const patientExists = receivedIds.some((entry) =>
      typeof entry === "object" ? entry.id === patientId : entry === patientId,
    )

    return patientExists
  } catch (error) {
    console.error("Error checking if patient was received:", error)
    return false
  }
}

// Helper function to clean up stale patient IDs
const cleanupReceivedPatients = async () => {
  try {
    const existingIds = await AsyncStorage.getItem(RECEIVED_PATIENTS_KEY)
    if (!existingIds) return

    let receivedIds: Array<{ id: string; timestamp: number } | string> = []

    // Safely parse the JSON, handling potential parsing errors
    try {
      receivedIds = JSON.parse(existingIds)
    } catch (parseError) {
      console.error("Error parsing received patients list during cleanup:", parseError)
      // If parsing fails, reset the storage with an empty array
      await AsyncStorage.setItem(RECEIVED_PATIENTS_KEY, JSON.stringify([]))
      return
    }

    // If the list is empty or not an array, no need to process further
    if (!Array.isArray(receivedIds) || receivedIds.length === 0) {
      return
    }

    const now = Date.now()
    let updatedList: Array<{ id: string; timestamp: number }> = []

    // Handle both old format (string[]) and new format (object[])
    for (const entry of receivedIds) {
      if (typeof entry === "string") {
        // Convert old format entries to new format
        updatedList.push({
          id: entry,
          timestamp: now, // We don't know when it was added, so use current time
        })
      } else if (typeof entry === "object" && entry !== null && "id" in entry && "timestamp" in entry) {
        // Keep only non-stale entries
        if (now - entry.timestamp < PATIENT_ID_EXPIRY_TIME) {
          updatedList.push(entry)
        }
      }
    }

    // Save the cleaned up list
    await AsyncStorage.setItem(RECEIVED_PATIENTS_KEY, JSON.stringify(updatedList))

    const removedCount = receivedIds.length - updatedList.length
    if (removedCount > 0) {
      console.log(`Cleaned up received patients list. Removed ${removedCount} stale entries.`)
    }
  } catch (error) {
    console.error("Error cleaning up received patients list:", error)
  }
}

// Helper function to remove a specific patient ID from the list
const removeReceivedPatientId = async (patientId: string) => {
  try {
    const existingIds = await AsyncStorage.getItem(RECEIVED_PATIENTS_KEY)
    if (!existingIds) return

    let receivedIds: Array<{ id: string; timestamp: number } | string> = []

    // Safely parse the JSON, handling potential parsing errors
    try {
      receivedIds = JSON.parse(existingIds)
    } catch (parseError) {
      console.error("Error parsing received patients list during removal:", parseError)
      return
    }

    // If the list is empty or not an array, no need to process further
    if (!Array.isArray(receivedIds) || receivedIds.length === 0) {
      return
    }

    // Filter out the specified patient ID (handling both old and new formats)
    const updatedList: Array<{ id: string; timestamp: number } | string> = receivedIds.filter((entry) => {
      if (typeof entry === "string") {
        return entry !== patientId
      }
      if (typeof entry === "object" && entry !== null && "id" in entry) {
        return entry.id !== patientId
      }
      return false
    })

    // Only update storage if something changed
    if (updatedList.length !== receivedIds.length) {
      await AsyncStorage.setItem(RECEIVED_PATIENTS_KEY, JSON.stringify(updatedList))
      console.log(`Removed patient ID ${patientId} from received patients list`)
    }
  } catch (error) {
    console.error(`Error removing patient ID ${patientId} from received list:`, error)
  }
}

// Helper function to clear all received patient IDs
const clearAllReceivedPatients = async () => {
  try {
    await AsyncStorage.removeItem(RECEIVED_PATIENTS_KEY)
    console.log("Cleared all received patient IDs")
  } catch (error) {
    console.error("Error clearing received patients list:", error)
  }
}

export interface SyncManagerProps {}

/**
 * Sync Manager component that manages device syncing
 */
export const SyncManager = observer(function SyncManager(props: SyncManagerProps) {
  const netInfo = useNetInfo()

  return <></>

  // FIXME: for now, always sync over P2P - fix later and replace with bottom code
  return <P2PSyncManager />

  if (netInfo.isInternetReachable) {
    return <ClientServerSyncManager />
  } else if (netInfo.isWifiEnabled && netInfo.type === "wifi") {
    return <P2PSyncManager />
  }
})

const router = createRouter()
  .get<"/health-check", { message: string }>("/health-check", async () => {
    const dbVersion = await db.schema.version
    let status = 500
    if (dbVersion) {
      status = 200
    }
    let message = "Ok"
    if (!dbVersion) {
      message = "Database is not reachable"
    }
    return {
      status: status,
      body: { message },
    }
  })
  // A device is sending a patient that they just created locally
  .post<
    "/patient/register",
    { patientRecord: PatientRecord; patientId: string },
    { success: boolean; message: string; patientId?: string }
  >("/patient/register", async (req) => {
    try {
      console.log("PPP: Received request to register patient: ", req)
      if (
        !req.body ||
        typeof req.body !== "object" ||
        Object.keys(req.body).length === 0 ||
        !req.body.patientRecord ||
        !req.body.patientId
      ) {
        console.warn("PPP: Missing required patient fields", req)
        return {
          status: 400,
          body: {
            success: false,
            message: "Missing required patient fields",
          },
        }
      }
      // Extract the patient data from the request body
      const { patientRecord, patientId } = req.body

      // Check if we've already received this patient to prevent duplicate registrations
      const alreadyReceived = await isReceivedPatient(patientId)
      if (alreadyReceived) {
        console.log(`PPP: Patient ${patientId} was already received, skipping registration`)
        return {
          status: 200,
          body: {
            success: true,
            message: "Patient already registered",
            patientId: patientId,
          },
        }
      }

      // Validate the request body to make sure the necessary fields are present
      const validationResult = validatePatientRecord(patientRecord)
      if (!validationResult.isValid) {
        console.log(`PPP: Patient validation failed: ${validationResult.message}`)
        return {
          status: 400,
          body: {
            success: false,
            message: validationResult.message,
          },
        }
      }

      console.log("checking for patient id and type")
      if (typeof patientId !== "string" || patientId.length === 0) {
        console.log(`PPP: Invalid patientId: ${patientId}`)
        return {
          status: 400,
          body: {
            success: false,
            message: "Invalid or missing patientId",
          },
        }
      }

      console.log("PPP: checking for existing patient")
      // Check if the patient with the given patientId is already registered
      try {
        const existingPatient = await db.get<PatientModel>("patients").find(patientId)
        if (existingPatient) {
          console.log(
            `PPP: Patient ${patientId} already exists in the database, skipping registration`,
          )
          return {
            status: 200,
            body: {
              success: true,
              message: "Patient already registered",
              patientId: patientId,
            },
          }
        }
      } catch (error) {
        // unable to get the patientId - means the patient does not exist
        // continue along
      }

      const newPatientId = await patientApi.register(patientRecord)
      let newPatient
      // manually set the id since it will not be the same as the one on the sending device
      await db.write(async () => {
        newPatient = await db.get<PatientModel>("patients").find(newPatientId)
        console.log("writing")
        newPatient._raw.id = patientId
        console.log("set id")
        newPatient._raw._status = "synced"
        // newPatient._raw._changed = ""
        console.log("written")

        // newPatient._raw._status === "synced"
      })

      // newPatient._setRaw("syncStatus", "updated")
      // TODO: consider what we need to do about the "changed" field
      // newPatient._raw._changed

      // Mark this patient as received from another device
      // TODO: The additional attributes are added with a new ID, the old id must be re-used
      await addReceivedPatientId(patientId)

      console.log("Successfully registered new patient from another device:", newPatient?.id)

      // TODO: of the new patient id still does not match the one on the sending device,
      // we need to delete the new patient and return an error

      return {
        status: 200,
        body: {
          success: true,
          message: "Patient successfully registered",
          patientId: newPatient.id,
        },
      }
    } catch (error) {
      console.error("Error registering patient:", error)
      return {
        status: 500,
        body: {
          success: false,
          message: "Error registering patient",
        },
      }
    }
  })
// .post<
//   "/patient/register",
//   { patientRecord: PatientRecord; patientId: string },
//   { success: boolean; message: string; patientId?: string }
// >("/patient/register", async (req) => {
//   try {
//     console.log("Received request to register patient: ", req)
//     if (!req.body || !req.body.patientRecord || !req.body.patientId) {
//       return {
//         status: 400,
//         body: {
//           success: false,
//           message: "Missing required patient fields",
//         },
//       }
//     }

//     // Extract the patient data from the request body
//     const { patientRecord, patientId } = req.body

//     // Validate the request body to make sure the necessary fields are present
//     const validationResult = validatePatientRecord(patientRecord)
//     if (!validationResult.isValid) {
//       return {
//         status: 400,
//         body: {
//           success: false,
//           message: validationResult.message,
//         },
//       }
//     }

//     if (typeof patientId !== "string" || patientId.length === 0) {
//       return {
//         status: 400,
//         body: {
//           success: false,
//           message: "Invalid or missing patientId",
//         },
//       }
//     }

//     const newPatientId = await patientApi.register(patientRecord)
//     const newPatient = await db.get<PatientModel>("patients").find(newPatientId)
//     // manually set the id since it will not be the same as the one on the sending device
//     newPatient._setRaw("id", patientId)

//     // Mark this patient as received from another device
//     await addReceivedPatientId(patientId)

//     console.log("Successfully registered new patient from another device:", newPatient.id)

//     // TODO: of the new patient id still does not match the one on the sending device,
//     // we need to delete the new patient and return an error

//     return {
//       status: 200,
//       body: {
//         success: true,
//         message: "Patient successfully registered",
//         patientId: newPatient.id,
//       },
//     }
//   } catch (error) {
//     console.error("Error registering patient:", error)
//     return {
//       status: 500,
//       body: {
//         success: false,
//         message: "Error registering patient",
//       },
//     }
//   }
// })

const P2PSyncManager = observer(function P2PSyncManager(props: SyncManagerProps) {
  const [currentPatientsCount, setCurrentPatientsCount] = useState(0)

  const [isLoadingRegistrationForm, setIsLoadingRegistrationForm] = useState(true)
  const [registrationForm, setRegistrationForm] = useState<RegistrationFormModel | null>(null)

  const [isListenerSet, setIsListenerSet] = useState(false)

  // FIXME: Put the password and salt in environment variables
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

  console.warn({ pairedDevices })

  // Set up periodic cleanup of received patients list
  useEffect(() => {
    // Run cleanup when component mounts
    cleanupReceivedPatients()

    // Set up interval to clean up stale patient IDs (every 6 hours)
    const cleanupInterval = setInterval(
      () => {
        cleanupReceivedPatients()
      },
      6 * 60 * 60 * 1000,
    )

    // Clean up interval when component unmounts
    return () => {
      clearInterval(cleanupInterval)
    }
  }, [])

  useEffect(() => {
    console.log("Entering P2PSyncManager")
    if (isLoadingRegistrationForm) {
      return console.log("Skipping P2PSyncManager because isLoadingRegistrationForm is true")
    }

    if (!isListenerSet) {
      console.log("Setting up listener for the first time")
      setIsListenerSet(true)
    }

    if (pairedDevices.length === 0) {
      console.log("Skipping P2PSyncManager because pairedDevices.length === 0")
      return
    }

    console.log("Setting up patient count observer with paired devices: ", pairedDevices)

    const subscription = db.collections
      .get<PatientModel>("patients")
      .query()
      .observeCount()
      .subscribe(async (count) => {
        console.log("Patient count changed:", count, "Previous count:", currentPatientsCount)

        // If this is the first count update, just store the current count
        if (currentPatientsCount === 0) {
          console.log("Initial count set to:", count)
          setCurrentPatientsCount(count)
          return
        }

        const countIncreased = count > currentPatientsCount
        setCurrentPatientsCount(count)

        if (!countIncreased) {
          // count has not increased, do nothing
          console.log("Count did not increase, skipping sync")
          return
        }

        console.log("Count increased, syncing new patient")
        // get the single most recently registered patient
        const patients = await db.collections
          .get<PatientModel>("patients")
          .query(Q.sortBy("created_at", "desc"), Q.take(1))
          .fetch()

        if (patients.length === 0) {
          return console.warn("There are no patients, but count has been detected to change")
        }

        const mostRecentPatient = patients[0]

        // Check if this patient was received from another device
        const wasReceived = await isReceivedPatient(mostRecentPatient.id)
        if (wasReceived) {
          console.log(
            `Patient ${mostRecentPatient.id} was received from another device, skipping sync`,
          )
          return
        }

        // get the patient record
        const patientRecord = await patientApi.getById(
          mostRecentPatient.id,
          registrationForm?.fields || [],
        )

        console.log("Patient record to be synced: ", patientRecord)

        const devices = pairedDevices

        console.warn({ devices })

        devices.forEach((device) => {
          console.log("Syncing patient record to device ", device.id)
          sendRequest<{ patientRecord: PatientRecord; patientId: string }, { success: boolean }>(
            "POST",
            "/patient/register",
            device.id,
            { patientRecord, patientId: mostRecentPatient.id },
          )
            .then((res) => {
              console.log("Successfully synced patient record to device ", device.id)
              console.log("Response from device: ", res)
            })
            .catch((error) => {
              console.error(
                `Failed to share patient with device ${device.id}:`,
                error,
                error.message,
              )
              return { success: false }
            })
        })
      })

    // Clean up the subscription when the component unmounts
    return () => {
      console.log("Cleaning up patient count observer")
      subscription.unsubscribe()
    }
  }, [
    currentPatientsCount,
    isLoadingRegistrationForm,
    isListenerSet,
    pairedDevices,
    pairedDevices.length,
    registrationForm,
  ])

  useEffect(() => {
    setIsLoadingRegistrationForm(true)
    const sub = db
      .get<RegistrationFormModel>("registration_forms")
      .query()
      .observe()
      .subscribe((res) => {
        if (res.length === 0) {
          console.error("There are no patient registration forms. This could be an error")
          console.warn("Overriding absent form with default form")
          return setRegistrationForm(initialFormState as unknown as RegistrationFormModel)
        }
        if (res.length > 1) {
          console.warn(
            "There are more than one registration form. Are you supporting multiple forms?",
          )
        }
        const patientRegistrationForm = res[0]
          ? {
              ...res[0],
              fields: res[0].fields.filter((field) => !field.deleted && field.visible),
            }
          : null
        setRegistrationForm(patientRegistrationForm as RegistrationFormModel | null)
        setIsLoadingRegistrationForm(false)
      })

    return () => {
      sub.unsubscribe()
    }
  }, [])

  return <View />
})

const ClientServerSyncManager = observer(function ClientServerSyncManager(props: SyncManagerProps) {
  return <View />
})

/**
 * Validates a patient record to ensure all required fields are present
 * @param patientRecord The patient record to validate
 * @returns An object with isValid flag and error message if invalid
 */
function validatePatientRecord(patientRecord: PatientRecord): {
  isValid: boolean
  message: string
} {
  // Check if patientRecord exists and is an object
  if (!patientRecord || typeof patientRecord !== "object") {
    return {
      isValid: false,
      message: "Invalid or missing patientRecord",
    }
  }

  // Validate that patientRecord has the required structure
  if (
    !patientRecord.fields ||
    !Array.isArray(patientRecord.fields) ||
    !patientRecord.values ||
    typeof patientRecord.values !== "object"
  ) {
    return {
      isValid: false,
      message: "patientRecord must contain fields array and values object",
    }
  }

  // Check for required base fields in the values
  const requiredBaseFields = ["given_name", "surname", "sex", "date_of_birth"]
  const missingBaseFields = requiredBaseFields.filter((field) => {
    const fieldId = patientRecord.fields.find((f) => f.column === field)?.id
    return fieldId ? !patientRecord.values[fieldId] : true
  })

  if (missingBaseFields.length > 0) {
    return {
      isValid: false,
      message: `Missing required patient fields: ${missingBaseFields.join(", ")}`,
    }
  }

  // Uncomment if we ever need to start validating against required fields in the registration form
  // Validate required fields marked in the registration form
  // const missingRequiredFields = patientRecord.fields
  //   .filter((field) => field.required && !field.deleted)
  //   .filter((field) => {
  //     const value = patientRecord.values[field.id]
  //     return value === undefined || value === null || value === ""
  //   })
  //   .map((field) => field.label.en || field.id)

  // if (missingRequiredFields.length > 0) {
  //   return {
  //     isValid: false,
  //     message: `Missing required fields: ${missingRequiredFields.join(", ")}`,
  //   }
  // }

  // If we made it here, the record is valid
  return {
    isValid: true,
    message: "Patient record validation successful",
  }
}
