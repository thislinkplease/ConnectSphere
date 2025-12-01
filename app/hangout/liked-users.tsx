import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, FlatList, Image, TouchableOpacity, StyleSheet } from "react-native";
import ApiService from "@/src/services/api";
import { useAuth } from "@/src/context/AuthContext";
import { useTheme } from "@/src/context/ThemeContext";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function LikedUsersScreen() {
  const { user: currentUser } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLikedUsers = async () => {
    if (!currentUser?.username) return;
    try {
      setLoading(true);

      // Lấy danh sách username mình đã swipe
      const usernames = await ApiService.getRightSwipes(currentUser.username);

      // Lấy profile từng user
      const profiles = await Promise.all(
        usernames.map((u) => ApiService.getUserByUsername(u))
      );

      setUsers(profiles);
    } catch (err) {
      console.log("loadLikedUsers error:", err);
    } finally {
      setLoading(false);
    }
  };

  const deleteSwipe = async (targetUsername: string) => {
    if (!currentUser?.username) return;

    try {
      await ApiService.deleteRightSwipe(currentUser.username, targetUsername);
      setUsers((prev) => prev.filter((u) => u.username !== targetUsername));
    } catch (err) {
      console.log("delete swipe error:", err);
    }
  };

  useEffect(() => {
    loadLikedUsers();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: colors.background }}>
      {/* <Text style={styles.title}>People You Liked</Text> */}
      <FlatList
        data={users}
        keyExtractor={(item) => item.username}
        renderItem={({ item }) => (
          <View style={[styles.userRow, { backgroundColor: colors.card }]}>
            <Image source={{ uri: item.avatar || item.backgroundImage }} style={styles.avatar} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
              <Text style={[styles.username, { color: colors.textSecondary }]}>@{item.username}</Text>
            </View>

            {/* VIEW PROFILE */}
            <TouchableOpacity onPress={() => router.push(`/account/profile?username=${item.username}`)}>
              <Ionicons name="person-circle-outline" size={28} color={colors.primary} />
            </TouchableOpacity>

            {/* DELETE */}
            <TouchableOpacity onPress={() => deleteSwipe(item.username)} style={{ marginLeft: 15 }}>
              <Ionicons name="trash-outline" size={26} color={colors.error} />
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 20 },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 10,
    elevation: 2,
  },
  avatar: { width: 55, height: 55, borderRadius: 28, marginRight: 12 },
  name: { fontSize: 16, fontWeight: "600" },
  username: { color: "#666" },
});
