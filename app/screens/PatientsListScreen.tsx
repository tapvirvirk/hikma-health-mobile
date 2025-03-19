import React, { FC, useEffect, useState } from "react"
import { observer } from "mobx-react-lite"
import { Alert, Pressable, StatusBar, ViewStyle } from "react-native"
import { AppStackScreenProps } from "../navigators"
import { If, PatientListItem, Text, TextField, View } from "../components"
import { FlashList } from "@shopify/flash-list"
import PatientModel from "../db/model/Patient"
import { colors } from "../theme"
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, SearchIcon, XIcon } from "lucide-react-native"
import { Picker } from "@react-native-picker/picker"
import { translate } from "../i18n"
import { useIsFocused } from "@react-navigation/native"
// import { useNavigation } from "@react-navigation/native"
import { useStores } from "../models"
import { usePatientRecordEditor } from "../hooks/usePatientRecordEditor"
import { usePatientsList } from "app/hooks/usePatientsList"

interface PatientsListScreenProps extends AppStackScreenProps<"PatientsList"> {}

export const PatientsListScreen: FC<PatientsListScreenProps> = observer(
  function PatientsListScreen({ navigation }) {
    const { language } = useStores()

    const isFocused = useIsFocused()

    const { formFields, patientRecord } = usePatientRecordEditor(undefined, language.current)
    const {
      patients,
      searchFilter,
      getNextPagePatients,
      resetSearchFilter,
      totalPatientsCount,
      setSearchField,
      searchParams,
      onChangeSearchParam,
      resetSearchParams,
      isLoading: isPatientListLoading,
    } = usePatientsList(30, patientRecord.fields)
    const [isExpandedSearch, setIsExpandedSearch] = useState(false)

    // On colapse expanded search, set year of birth and sex to empty
    useEffect(() => {
      if (!isExpandedSearch) {
        setSearchField("yearOfBirth", "")
        setSearchField("sex", "")
        resetSearchParams()
      }
    }, [isExpandedSearch])

    /**
     * Open patient details screen by forwarding the patientID to the patient details screen
     * @param {string} patientId - The patient ID
     */
    const openPatientDetails = (patientId: string, patient?: PatientModel) => {
      navigation.navigate("PatientView", { patientId, patient })
    }

    const openPatientEditOptions = (patientId: string) => {
      Alert.alert(
        translate("patientList:managePatient"),
        "",
        [
          {
            text: translate("common:delete"),
            onPress: () => {
              return Alert.alert(
                "Delete not allowed",
                "Deleting patients in currently not allowed. Contact your administrator",
                [{ text: "OK" }],
                {
                  cancelable: true,
                },
              )
              // Alert.alert(
              //   translate("patientList.deletePatientQuestion"),
              //   translate("patientList.confirmDeletePatient"),
              //   [
              //     { text: translate("cancel") },
              //     {
              //       text: translate("delete"),
              //       onPress: () => {
              //         patientApi.deleteById(patientId)
              //       },
              //     },
              //   ],
              //   {
              //     cancelable: true,
              //   },
              // )
            },
          },
        ],
        {
          cancelable: true,
        },
      )
    }

    /**
     * Open patient register form screen
     */
    const openPatientRegisterForm = () => {
      navigation.navigate("PatientRecordEditor", { editPatientId: undefined })
    }

    // console.log({
    //   patients: patients.slice(0, 2).map(({ syncStatus, _isEditing, __changes, _raw }) => ({
    //     syncStatus,
    //     _isEditing,
    //     __changes,
    //     change_values_closed: __changes?.closed,
    //     change_values_value: __changes?.value,
    //     _raw,
    //     id: _raw.id,
    //     givenName: _raw.given_name,
    //   })),
    // })

    return (
      <>
        <StatusBar barStyle="dark-content" backgroundColor={colors.palette.neutral200} />
        <FlashList
          contentContainerStyle={$patientList}
          onRefresh={getNextPagePatients}
          refreshing={false}
          disableAutoLayout={true}
          ListHeaderComponent={
            <View pb={10} pt={6} gap={4}>
              <TextField
                RightAccessory={() =>
                  searchFilter.query.length > 0 ? (
                    <Pressable
                      style={{ alignSelf: "center", marginRight: 10, marginLeft: 10 }}
                      onPress={resetSearchFilter}
                    >
                      <XIcon color={colors.palette.neutral700} size={16} />
                    </Pressable>
                  ) : (
                    <SearchIcon
                      style={{ alignSelf: "center", marginRight: 10, marginLeft: 10 }}
                      color={colors.palette.neutral700}
                      size={16}
                    />
                  )
                }
                value={searchFilter.query}
                onChangeText={(query) => setSearchField("query", query)}
                placeholderTx="patientList:nameSearch"
              />

              <View gap={8}>
                <If condition={isExpandedSearch}>
                  {formFields
                    .filter((f) => f.isSearchField)
                    // ignore date fields for now
                    // FIXME: Add support for date field filters
                    // .filter((f) => f.type !== "date")
                    .map((field) => {
                      const { type } = field
                      const keyboardType = (() => {
                        if (type === "number" || type === "date") {
                          return "number-pad"
                        } else {
                          return "default"
                        }
                      })()
                      return (
                        <View direction="row" gap={8} key={field.id}>
                          <View flex={1}>
                            <TextField
                              value={searchParams[field.id] || ""}
                              // onChangeText={(yob) => setSearchField("yearOfBirth", yob)}
                              onChangeText={(t) => onChangeSearchParam(field.id, t)}
                              placeholder={
                                field.type === "date" ? `${field.label} (Year only)` : field.label
                              }
                              keyboardType={keyboardType}
                            />
                          </View>
                        </View>
                      )
                    })}
                  {isPatientListLoading && <Text text="Loading ..." />}
                </If>
              </View>

              <View>
                {isExpandedSearch && false && (
                  <View direction="row" gap={8}>
                    <View flex={1}>
                      <TextField
                        value={searchFilter.yearOfBirth}
                        onChangeText={(yob) => setSearchField("yearOfBirth", yob)}
                        placeholderTx="common:yearOfBirth"
                        keyboardType="number-pad"
                      />
                    </View>

                    <View flex={1}>
                      <Picker
                        selectedValue={searchFilter.sex}
                        onValueChange={(sex) => setSearchField("sex", sex)}
                      >
                        <Picker.Item label={translate("common:sex")} value="" />
                        <Picker.Item label={translate("common:male")} value="male" />
                        <Picker.Item label={translate("common:female")} value="female" />
                      </Picker>
                    </View>
                  </View>
                )}
              </View>

              <View direction="row" justifyContent="space-between" alignItems="flex-start">
                <Text
                  text={`${translate("common:showing")} ${
                    patients.length
                  } / ${totalPatientsCount.toLocaleString()}`}
                />
                <View alignItems="flex-end">
                  <Pressable onPress={() => setIsExpandedSearch((ex) => !ex)}>
                    <View direction="row" alignItems="flex-end" gap={8}>
                      <Text
                        size="xs"
                        tx={
                          isExpandedSearch
                            ? "patientList:hideSearchOptions"
                            : "patientList:showSearchOptions"
                        }
                      />
                      {!isExpandedSearch ? (
                        <ChevronDownIcon size={18} color={colors.palette.neutral800} />
                      ) : (
                        <ChevronUpIcon size={18} color={colors.palette.neutral800} />
                      )}
                    </View>
                  </Pressable>
                </View>
              </View>
            </View>
          }
          ItemSeparatorComponent={() => <View style={$separator} />}
          ListFooterComponent={() => <View style={{ height: 40 }} />}
          data={patients}
          estimatedItemSize={113}
          extraData={isFocused}
          renderItem={({ item }) => (
            <PatientListItem
              onPatientLongPress={openPatientEditOptions}
              patient={item}
              onPatientSelected={openPatientDetails}
            />
          )}
        />

        <Pressable onPress={openPatientRegisterForm} style={$newVisitFAB}>
          <PlusIcon color={"white"} size={20} style={{ marginRight: 10 }} />
          <Text color="white" size="sm" text={translate("newPatient:newPatient")} />
        </Pressable>
      </>
    )
  },
)

const $root: ViewStyle = {
  flex: 1,
  paddingTop: 10,
  backgroundColor: colors.background,
}

const $patientList = {
  paddingHorizontal: 12,
}

const $newVisitFAB: ViewStyle = {
  display: "flex",
  flexDirection: "row",
  position: "absolute",
  bottom: 60,
  right: 24,
  elevation: 4,
  zIndex: 100,
  borderRadius: 10,
  padding: 14,
  backgroundColor: colors.palette.primary500,
  justifyContent: "center",
  alignItems: "center",
}

const $separator: ViewStyle = {
  height: 1,
  backgroundColor: colors.border,
  marginVertical: 6,
}
