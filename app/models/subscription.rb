# == Schema Info
#
# Table name: subscriptions
#
#  id       :integer         not null, primary key
#  user_id  :integer
#  topic_id :integer

class Subscription < ActiveRecord::Base
  
  attr_accessible :topic_id, :user_id
  
  belongs_to :topic
  belongs_to :user
  
  validates_uniqueness_of :topic_id, :scope => :user_id
  
  def to_s
    id.to_s
  end
  
end
